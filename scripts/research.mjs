#!/usr/bin/env node
import { main } from './research/cli.mjs'

main().catch((error) => {
  console.error(error?.message ?? String(error))
  process.exitCode = 1
})
