import { smtpFailureStatus, winnerMessage } from './message.js'

export function createWinnerMailHandler({ env, rpc, createTransport }) {
  return async function handler(request) {
    const secret = env('AUCTION_CRON_SECRET')
    if (!secret || secret.length < 32 || request.headers.get('x-auction-secret') !== secret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (request.method !== 'POST') return new Response(null, { status: 405 })
    let transport
    try {
      await rpc('finalize_auction')
      const password = env('GMAIL_APP_PASSWORD')?.replace(/\s/g, '')
      if (!password) return Response.json({ error: 'Email is not configured' }, { status: 503 })
      transport = createTransport(password)
      let processed = 0
      for (let count = 0; count < 5; count++) {
        const job = await rpc('claim_winner_email')
        if (!job) break
        let status
        let messageId = null
        let safeError = null
        try {
          const result = await transport.sendMail(winnerMessage(job.payload))
          status = result.accepted?.includes(job.payload.email) ? 'accepted' : 'needs_review'
          messageId = result.messageId ?? null
          if (status !== 'accepted') safeError = 'Recipient not accepted; check Gmail Sent.'
        } catch (error) {
          status = smtpFailureStatus(error)
          // SMTP error messages can include credentials or recipient addresses.
          safeError = status === 'pending' ? 'SMTP refused the send; retry scheduled.' :
            'Delivery uncertain or invalid; check Gmail Sent before retrying.'
        }
        await rpc('finish_winner_email', {
          p_artwork_id: job.artwork_id, p_claim_token: job.claim_token,
          p_status: status, p_message_id: messageId, p_error: safeError,
        })
        processed++
      }
      return Response.json({ processed })
    } catch {
      return Response.json({ error: 'Winner processing failed; check job status.' }, { status: 503 })
    } finally {
      transport?.close()
    }
  }
}
