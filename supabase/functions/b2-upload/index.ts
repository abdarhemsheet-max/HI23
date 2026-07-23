import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const B2_KEY_ID = Deno.env.get('B2_KEY_ID')
const B2_KEY_SECRET = Deno.env.get('B2_KEY_SECRET')
const B2_BUCKET_ID = Deno.env.get('B2_BUCKET_ID')

if (!B2_KEY_ID || !B2_KEY_SECRET || !B2_BUCKET_ID) {
  throw new Error('Missing required B2 environment variables')
}

async function getAuthToken() {
  const basic = btoa(`${B2_KEY_ID}:${B2_KEY_SECRET}`)
  const res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
    headers: { Authorization: `Basic ${basic}` },
  })
  return await res.json()
}

async function getUploadUrl(apiUrl: string, authToken: string) {
  const res = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: 'POST',
    headers: {
      Authorization: authToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bucketId: B2_BUCKET_ID }),
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
    const formData = await req.formData()
    const file = formData.get('file') as File
    const customName = formData.get('fileName') as string | null

    if (!file) {
      return new Response(JSON.stringify({ error: 'file is required' }), {
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

    const uploadInfo = await getUploadUrl(auth.apiUrl, auth.authorizationToken)
    if (!uploadInfo.uploadUrl || !uploadInfo.authorizationToken) {
      return new Response(JSON.stringify({ error: 'B2 upload URL generation failed' }), {
        status: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const fileBuffer = await file.arrayBuffer()
    const sha1 = await crypto.subtle.digest('SHA-1', fileBuffer).then(b => {
      const hex = Array.from(new Uint8Array(b)).map(v => v.toString(16).padStart(2, '0')).join('')
      return hex
    })

    const storedName = customName || `${Date.now()}-${file.name}`

    const uploadRes = await fetch(uploadInfo.uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: uploadInfo.authorizationToken,
        'X-Bz-File-Name': encodeURIComponent(storedName),
        'Content-Type': file.type || 'application/octet-stream',
        'X-Bz-Content-Sha1': sha1,
        'Content-Length': file.size.toString(),
      },
      body: fileBuffer,
    })

    if (!uploadRes.ok) {
      const errBody = await uploadRes.text()
      return new Response(JSON.stringify({ error: `B2 upload failed: ${errBody}` }), {
        status: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const uploadResult = await uploadRes.json()
    if (!uploadResult.fileName) {
      return new Response(JSON.stringify({ error: 'B2 upload succeeded but no fileName returned' }), {
        status: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ upload: uploadResult }), {
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