/** @type {import('next').NextConfig} */
const nextConfig = {
  // Expose no server-side env vars to the client bundle.
  // OPENAI_API_KEY and PARENT_CODE must stay server-side only.
  // If you ever need a public variable, prefix it with NEXT_PUBLIC_.
  env: {},

  // Increase the body size limit for image uploads sent to /api/correct-homework
  // (default is 4 MB; photos from phone cameras can exceed that)
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

module.exports = nextConfig
