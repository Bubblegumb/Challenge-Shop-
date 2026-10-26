import { useEffect, useState } from 'react'
import { auctionConfigured, getAuction } from '../services/auction'

function received(previous, auction) {
  if (previous.auction && Date.parse(previous.auction.server_time) > Date.parse(auction.server_time)) return previous
  return { auction, error: '', loading: false, receivedAt: Date.now() }
}

export default function useAuction() {
  const [state, setState] = useState({ auction: null, error: '', loading: auctionConfigured, receivedAt: null })
  useEffect(() => {
    if (!auctionConfigured) return
    let active = true
    let inFlight = false
    const controller = new AbortController()
    async function refresh() {
      if (inFlight) return
      inFlight = true
      try {
        const auction = await getAuction(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]))
        if (active) setState(previous => received(previous, auction))
      } catch (error) {
        if (active) setState(previous => ({ ...previous, error: error.message, loading: false }))
      } finally {
        inFlight = false
      }
    }
    refresh()
    const timer = setInterval(refresh, 15000)
    window.addEventListener('focus', refresh)
    return () => {
      active = false
      controller.abort()
      clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [])
  return { ...state, updateAuction: auction => setState(previous => received(previous, auction)) }
}
