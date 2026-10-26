const projectUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const auctionConfigured = Boolean(projectUrl && publishableKey)

export async function supabaseRequest(path, body, token, signal, method = 'POST') {
  if (!auctionConfigured) throw new Error('Bidding is being prepared. Please check back soon.')
  let response
  try {
    response = await fetch(`${projectUrl}${path}`, {
      method,
      headers: {
        apikey: publishableKey,
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: signal ?? AbortSignal.timeout(15000),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw Object.assign(new Error('Could not reach the auction. Please try again.', { cause: error }), { uncertain: true })
  }
  const result = await response.json().catch(() => null)
  if (!response.ok) {
    const messages = {
      AUCTION_CLOSED: 'Bidding has closed. No further bids can be accepted.',
      AUCTION_NOT_OPEN: 'Bidding is not open yet. Please check back soon.',
      BID_TOO_LOW: 'Someone has placed a higher bid. Check the current amount and try again.',
      INVALID_BID: 'Enter a valid amount, name, and email address.',
      RATE_LIMITED: 'Please wait a moment before bidding again.',
      REQUEST_CONFLICT: 'Please close the form and try again.',
      OWNER_ONLY: 'This account does not have owner access.',
      ARTWORK_LOCKED: 'This artwork has been secured at $75 AUD. No further bids can be placed.',
      EMAIL_NOT_VERIFIED: 'Verify your email address before placing a bid.',
    }
    const authCode = result?.error_code ?? result?.code
    const code = messages[result?.message] ? result.message : authCode
    const message = messages[code] ?? (
      response.status === 429 ? 'Please wait a moment before requesting another code.' :
      path === '/auth/v1/verify' ? 'That code is invalid or expired. Check the code or request a new one.' :
      path === '/auth/v1/otp' ? 'Could not send a verification code. Please try again shortly.' :
      path === '/auth/v1/recover' ? 'Could not send a recovery code. Please try again shortly.' :
      path === '/auth/v1/user' ? 'Could not update the password. Check the password requirements or request a new recovery code.' :
      path.startsWith('/auth/') ? 'Sign-in failed. Check your email and password.' :
      response.status === 401 ? messages.EMAIL_NOT_VERIFIED :
        'The auction is temporarily unavailable. Please try again.'
    )
    throw Object.assign(new Error(message), {
      code: response.status === 401 && !path.startsWith('/auth/') ? 'EMAIL_NOT_VERIFIED' : code,
      uncertain: response.status >= 500,
    })
  }
  return result
}

export function getAuction(signal) {
  return supabaseRequest('/rest/v1/rpc/auction_snapshot', {}, null, signal)
}

export function requestBidCode(email) {
  return supabaseRequest('/auth/v1/otp', { email: email.trim().toLowerCase(), create_user: true })
}

export async function verifyBidCode(email, code) {
  const result = await supabaseRequest('/auth/v1/verify', {
    email: email.trim().toLowerCase(), token: code.trim(), type: 'email',
  })
  if (!result?.access_token) throw new Error('Email verification could not be completed. Please request a new code.')
  return result.access_token
}

export async function placeBid(bid, accessToken) {
  if (!accessToken) throw new Error('Verify your email address before placing a bid.')
  const result = await supabaseRequest('/rest/v1/rpc/submit_bid', bid, accessToken)
  if (result?.accepted !== true) {
    throw Object.assign(new Error('The bid result could not be confirmed. Please check the result again.'), { uncertain: true })
  }
  return result
}

export function ownerSignIn(email, password) {
  return supabaseRequest('/auth/v1/token?grant_type=password', { email, password })
}

export function requestPasswordRecovery(email) {
  return supabaseRequest('/auth/v1/recover', { email: email.trim().toLowerCase() })
}

export async function verifyRecoveryCode(email, code) {
  const result = await supabaseRequest('/auth/v1/verify', {
    email: email.trim().toLowerCase(), token: code.trim(), type: 'recovery',
  })
  if (!result?.access_token) throw new Error('Recovery could not be verified. Request a new code.')
  return result.access_token
}

export function updateRecoveredPassword(password, token) {
  return supabaseRequest('/auth/v1/user', { password }, token, undefined, 'PUT')
}

export function getOwnerResults(token) {
  return supabaseRequest('/rest/v1/rpc/owner_results', {}, token)
}

export function markDonationConfirmed(artworkId, token) {
  return supabaseRequest('/rest/v1/rpc/owner_confirm_donation', { p_artwork_id: artworkId }, token)
}

export function ownerSignOut(token) {
  return supabaseRequest('/auth/v1/logout', {}, token)
}
