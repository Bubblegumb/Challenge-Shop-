import nodemailer from 'npm:nodemailer@10.2.1'
import { createWinnerMailHandler } from './handler.js'
import { SENDER_EMAIL } from './message.js'

const env = name => Deno.env.get(name)

async function rpc(name, parameters = {}) {
  const key = env('AUCTION_SUPABASE_SECRET_KEY') ?? env('SUPABASE_SERVICE_ROLE_KEY')
  if (!key) throw new Error('Database access is not configured')
  const response = await fetch(`${env('SUPABASE_URL')}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: {
      apikey: key, 'Content-Type': 'application/json',
      ...(key.startsWith('eyJ') ? { Authorization: `Bearer ${key}` } : {}),
    },
    body: JSON.stringify(parameters),
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error('Database operation failed')
  const body = await response.text()
  return body ? JSON.parse(body) : null
}

Deno.serve(createWinnerMailHandler({
  env, rpc,
  createTransport: password => nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: SENDER_EMAIL, pass: password },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
  }),
}))
