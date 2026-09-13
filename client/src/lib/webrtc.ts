export const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

// STUN-only, no TURN relay: fine for most home/mobile networks, but a peer
// behind a symmetric NAT (common on some corporate/carrier networks) may
// simply fail to connect audio — that's handled as a per-peer "failed"
// status, not a crash. If that turns out to happen often in practice, the
// next step is either a small self-hosted TURN relay (coturn on a cheap VPS)
// or migrating this mesh to a managed service (LiveKit has the most
// generous free tier and is open-source) — not something to build
// speculatively before it's actually a problem.
