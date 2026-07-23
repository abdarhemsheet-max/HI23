import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const B2_KEY_ID = Deno.env.get('B2_KEY_ID')
const B2_KEY_SECRET = Deno.env.get('B2_KEY_SECRET')
const B2_BUCKET_ID = Deno.env.get('B2_BUCKET_ID')
const B2_BUCKET_NAME = Deno.env.get('B2_BUCKET_NAME')

if (!B2_KEY_ID || !B2_KEY_SECRET || !B2_BUCKET_ID || !B2_BUCKET_NAME) {
  throw new Error('Missing required B2 environment variables')
}

async function getAuthToken() {
  const basic = btoa(`${B2_KEY_ID}:${B2_KEY_SECRET}`)
  const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: { Authorization: `Basic ${basic}` },
  })
  return await res.json()
}

async function getDownloadAuth(apiUrl: string, authToken: string, fileName: string) {
  const res = await fetch(`${apiUrl}/b2api/v2/b2_get_download_authorization`, {
    method: 'POST',
    headers: {
      Authorization: authToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      bucketId: B2_BUCKET_ID,
      fileNamePrefix: fileName,
      validDurationInSeconds: 3600,
    }),
  })
  return await res.json()
}

serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers })
  }

  try {
    const { filePath } = await req.json()
    if (!filePath) {
      return new Response(JSON.stringify({ error: 'filePath is required' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const auth = await getAuthToken()
    if (!auth.apiUrl || !auth.authorizationToken || !auth.downloadUrl) {
      return new Response(JSON.stringify({ error: auth.message || 'B2 authentication failed' }), {
        status: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const dlAuth = await getDownloadAuth(auth.apiUrl, auth.authorizationToken, filePath)
    if (!dlAuth.authorizationToken) {
      return new Response(JSON.stringify({ error: 'B2 download authorization failed' }), {
        status: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const downloadUrl = `${auth.downloadUrl}/file/${B2_BUCKET_NAME}/${filePath}?Authorization=${dlAuth.authorizationToken}`

    return new Response(JSON.stringify({ downloadUrl }), {
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
