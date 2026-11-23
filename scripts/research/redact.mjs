const PATTERNS = [
  /gsk_[A-Za-z0-9_-]{6,}/g,
  /sk-[A-Za-z0-9_-]{6,}/g,
  /AIza[A-Za-z0-9_-]{18,}/g,
  /fllm-[A-Za-z0-9_-]{6,}/g,
  /Bearer\s+[A-Za-z0-9._-]+/g,
]

export function redact(message, secrets = []) {
  let output = String(message ?? '')
  for (const secret of secrets) {
    if (secret) output = output.split(secret).join('[redacted]')
  }
  for (const pattern of PATTERNS) output = output.replace(pattern, '[redacted]')
  return output
}
