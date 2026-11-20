#!/usr/bin/env node
// Generates a self-signed TLS certificate for https://localhost, used by the
// Vite dev server so the iManage OAuth redirect (which must be HTTPS, even
// in local development) has somewhere valid to land.
//
// Prefer `mkcert` if it is installed, since it installs a local CA your
// browser already trusts and avoids the one-time certificate warning. This
// script falls back to a plain OpenSSL self-signed certificate otherwise.
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const certsDir = path.join(root, 'certs')
const certPath = path.join(certsDir, 'localhost-cert.pem')
const keyPath = path.join(certsDir, 'localhost-key.pem')

mkdirSync(certsDir, { recursive: true })

function hasCommand(command) {
  try {
    execSync(`${command} version`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

if (hasCommand('mkcert')) {
  console.log('Using mkcert to generate a locally-trusted certificate...')
  execSync(`mkcert -cert-file "${certPath}" -key-file "${keyPath}" localhost 127.0.0.1 ::1`, {
    stdio: 'inherit',
    cwd: certsDir,
  })
} else {
  console.log('mkcert not found; generating a self-signed certificate with OpenSSL.')
  console.log('Your browser will show a one-time certificate warning for https://localhost — this is expected.')
  console.log('Install mkcert (https://github.com/FiloSottile/mkcert) to avoid that warning.')

  const opensslConfigPath = path.join(certsDir, '.openssl-san.cnf')
  writeFileSync(
    opensslConfigPath,
    `[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
`,
  )

  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -nodes -keyout "${keyPath}" -out "${certPath}" -days 825 -config "${opensslConfigPath}"`,
      { stdio: 'inherit' },
    )
  } finally {
    rmSync(opensslConfigPath, { force: true })
  }
}

if (existsSync(certPath) && existsSync(keyPath)) {
  console.log(`\nCertificate written to ${path.relative(root, certPath)}`)
  console.log(`Key written to ${path.relative(root, keyPath)}`)
} else {
  console.error('Certificate generation appears to have failed — check the output above.')
  process.exitCode = 1
}
