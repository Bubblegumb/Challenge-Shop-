const projectUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const auctionConfigured = Boolean(projectUrl && publishableKey)

export async function supabaseRequest(path, body, token, signal) {
  if (!auctionConfigured) throw new Error('Bidding is being prepared. Please check back soon.')
  let response
  try {
    response = await fetch(`${projectUrl}${path}`, {
      method: 'POST',
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
    throw new Error('Could not reach the auction. Please try again.', { cause: error })
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
    }
    throw new Error(messages[result?.message] ?? (
      path.startsWith('/auth/') ? 'Sign-in failed. Check your email and password.' :
        'The auction is temporarily unavailable. Please try again.'
    ))
  }
  return result
}

export function getAuction(signal) {
  return supabaseRequest('/rest/v1/rpc/auction_snapshot', {}, null, signal)
}

export function placeBid(bid) {
  return supabaseRequest('/rest/v1/rpc/submit_bid', bid)
}

export function ownerSignIn(email, password) {
  return supabaseRequest('/auth/v1/token?grant_type=password', { email, password })
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
