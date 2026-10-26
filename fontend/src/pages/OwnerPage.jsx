import { useRef, useState } from 'react'
import { auctionConfigured, getOwnerResults, markDonationConfirmed, ownerSignIn, ownerSignOut } from '../services/auction'
import { formatBid } from '../utils/bidding'

export default function OwnerPage() {
  const [session, setSession] = useState(null)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const busy = useRef(false)

  async function run(operation) {
    if (busy.current) return
    busy.current = true
    setPending(true)
    setError('')
    try { await operation() } catch (failure) { setError(failure.message) }
    finally { busy.current = false; setPending(false) }
  }

  function signIn(event) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    run(async () => {
      const auth = await ownerSignIn(values.get('email'), values.get('password'))
      const records = await getOwnerResults(auth.access_token)
      form.reset()
      setSession(auth.access_token)
      setResults(records)
    })
  }

  async function signOut() {
    const token = session
    setSession(null)
    setResults(null)
    setError('')
    await ownerSignOut(token).catch(() => {})
  }

  return (
    <main className="owner-page">
      <a href="#gallery">← Back to gallery</a>
      <h1>Auction owner</h1>
      {!auctionConfigured && <p>Complete the Supabase connection setup to use this page.</p>}
      {!session ? <form className="auction-form" onSubmit={signIn}>
        <p>Sign in with your owner account. Bidders do not need an account.</p>
        <label>Email<input name="email" type="email" autoComplete="username" required disabled={pending} /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required disabled={pending} /></label>
        <button className="auction-button" disabled={pending || !auctionConfigured}>{pending ? 'Signing in…' : 'Sign in'}</button>
      </form> : <>
        <div className="owner-controls">
          <button className="auction-button" disabled={pending} onClick={() => run(async () => setResults(await getOwnerResults(session)))}>Refresh</button>
          <button className="auction-button" onClick={signOut} disabled={pending}>Sign out</button>
        </div>
        <p>Private current highest bidders. Email status “accepted” means the email provider accepted the message; it does not guarantee inbox delivery.</p>
        <div className="owner-table-wrap"><table>
          <caption>Highest bids and collection payments</caption>
          <thead><tr>{['Artwork', 'Amount', 'Name', 'Email', 'Auction', 'Winner email', 'Donation'].map(label => <th key={label}>{label}</th>)}</tr></thead>
          <tbody>{results?.map(row => <tr key={row.artwork_id}>
            <td>{row.title}</td><td>{row.amount_cents == null ? 'No bids' : `${formatBid(row.amount_cents)} AUD`}</td>
            <td>{row.bidder_name ?? '—'}</td><td>{row.bidder_email ?? '—'}</td>
            <td>{row.finalized ? (row.amount_cents == null ? 'Unsold' : 'Winner confirmed') : 'Not finalized'}</td>
            <td>{row.email_status ?? '—'}</td>
            <td>{row.donation_confirmed_at ? 'Confirmed' : row.finalized && row.amount_cents != null ?
              <button disabled={pending} onClick={() => run(async () => {
                await markDonationConfirmed(row.artwork_id, session)
                setResults(await getOwnerResults(session))
              })}>Confirm received</button> : '—'}</td>
          </tr>)}</tbody>
        </table></div>
      </>}
      {error && <p role="alert" className="auction-error">{error} If your session expired, sign out and sign in again.</p>}
    </main>
  )
}
