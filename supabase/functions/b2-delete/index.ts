import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const B2_KEY_ID = Deno.env.get('B2_KEY_ID')
const B2_KEY_SECRET = Deno.env.get('B2_KEY_SECRET')

if (!B2_KEY_ID || !B2_KEY_SECRET) {
  throw new Error('Missing required B2 environment variables')
}

async function getAuthToken() {
  const basic = btoa(`${B2_KEY_ID}:${B2_KEY_SECRET}`)
  const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: { Authorization: `Basic ${basic}` },
  })
  return await res.json()
}

serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, X-Client-Info',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers })
  }

  try {
    const { fileName, fileId } = await req.json()
    if (!fileName || !fileId) {
      return new Response(JSON.stringify({ error: 'fileName and fileId are required' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const auth = await getAuthToken()
    if (!auth.apiUrl || !auth.authorizationToken) {
      return new Response(JSON.stringify({ error: auth.message || 'B2 authentication failed' }), {
        status: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_delete_file_version`, {
      method: 'POST',
      headers: {
        Authorization: auth.authorizationToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName, fileId }),
    })

    if (!res.ok) {
      const errBody = await res.text()
      return new Response(JSON.stringify({ error: `B2 delete failed: ${errBody}` }), {
        status: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }
})