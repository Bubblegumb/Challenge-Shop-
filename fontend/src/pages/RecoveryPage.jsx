import { useRef, useState } from 'react'
import { auctionConfigured, ownerSignOut, requestPasswordRecovery, updateRecoveredPassword, verifyRecoveryCode } from '../services/auction'

export default function RecoveryPage() {
  const [email, setEmail] = useState('')
  const [stage, setStage] = useState('email')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const token = useRef(null)
  const busy = useRef(false)

  async function submit(event) {
    event.preventDefault()
    if (busy.current) return
    const form = event.currentTarget
    const values = new FormData(form)
    setError('')
    busy.current = true
    setPending(true)
    try {
      if (stage === 'email') {
        const address = values.get('email').trim().toLowerCase()
        await requestPasswordRecovery(address)
        setEmail(address)
        setStage('password')
      } else {
        const password = values.get('password')
        if (password !== values.get('confirmation')) throw new Error('The passwords do not match.')
        if (!token.current) token.current = await verifyRecoveryCode(email, values.get('code'))
        await updateRecoveredPassword(password, token.current)
        const recoveryToken = token.current
        token.current = null
        form.reset()
        setStage('done')
        await ownerSignOut(recoveryToken).catch(() => {})
      }
    } catch (failure) {
      setError(failure.message)
    } finally {
      busy.current = false
      setPending(false)
    }
  }

  function restart() {
    const recoveryToken = token.current
    token.current = null
    if (recoveryToken) ownerSignOut(recoveryToken).catch(() => {})
    setError('')
    setStage('email')
  }

  return <main className="owner-page">
    <a href="#owner">Back to owner sign-in</a>
    <h1>Reset your password</h1>
    {!auctionConfigured && <p>Complete the Supabase connection setup to use password recovery.</p>}
    {stage === 'done' ? <p role="status">Your password has been updated. <a href="#owner">Sign in with your new password.</a></p> :
      <form key={stage} className="auction-form" onSubmit={submit}>
        {stage === 'email' ? <>
          <p>Enter your owner account email to request a recovery code.</p>
          <label>Email<input name="email" type="email" autoComplete="username" required disabled={pending} /></label>
        </> : <>
          <p role="status">If an account exists for {email}, a recovery code has been sent. Check your inbox and spam folder.</p>
          <label>Recovery code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" required disabled={pending} /></label>
          <label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} required disabled={pending} /></label>
          <label>Confirm new password<input name="confirmation" type="password" autoComplete="new-password" minLength={12} required disabled={pending} /></label>
          <p>Use at least 12 characters. Your account may require additional password rules.</p>
        </>}
        <button className="auction-button" disabled={pending || !auctionConfigured}>
          {pending ? 'Please wait…' : stage === 'email' ? 'Send recovery code' : 'Update password'}
        </button>
        {stage === 'password' && <button type="button" onClick={restart} disabled={pending}>Request a new code or change email</button>}
      </form>}
    {error && <p role="alert" className="auction-error">{error}</p>}
  </main>
}
