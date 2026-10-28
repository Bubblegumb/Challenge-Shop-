export const SENDER_EMAIL = 'sujaljoshi77@gmail.com'

export function winnerMessage(payload) {
  const amount = new Intl.NumberFormat('en-AU', {
    style: 'currency', currency: 'AUD', minimumFractionDigits: 2,
  }).format(payload.amount_cents / 100)
  const donation = new URL(payload.donation_url)
  if (donation.protocol !== 'https:') throw new Error('Donation URL must use HTTPS')
  return {
    from: `Sujal's Challenge <${SENDER_EMAIL}>`,
    to: payload.email,
    replyTo: SENDER_EMAIL,
    subject: `You secured ${payload.title.replace(/[\r\n]/g, ' ')} — Sujal's Challenge`,
    text: [
      `Hi ${payload.name},`,
      '',
      `Bidding has closed, and you secured ${payload.title} with the highest bid of ${amount} AUD.`,
      '',
      'IMPORTANT: YOUR ARTWORK IS UNFRAMED. NO FRAME IS INCLUDED.',
      'Any frame shown on the website is for display only.',
      '',
      `Please donate exactly ${amount} AUD using this fundraising page:`,
      donation.href,
      '',
      'Your donation is payment for the artwork. Please reply with your donation confirmation so I can match it to your winning bid.',
      '',
      'Artwork handover will take place in Meeting Room 1 at the State Library on Friday 30 October 2026 from 1:00 pm to 1:55 pm (Sydney time).',
      '',
      `Questions? Reply to this email at ${SENDER_EMAIL}.`,
      '',
      'Thank you,',
      'Sujal',
    ].join('\n'),
  }
}

export function smtpFailureStatus(error) {
  // An explicit SMTP refusal or a failure before sending DATA is safe to retry.
  // A lost connection after DATA may already have delivered the message.
  if (error.code === 'EENVELOPE' || error.code === 'EMESSAGE') return 'needs_review'
  if (['CONN', 'AUTH', 'EHLO', 'HELO', 'STARTTLS'].includes(error.command)) return 'pending'
  if (Number.isInteger(error.responseCode) && error.responseCode >= 400) return 'pending'
  return 'needs_review'
}
