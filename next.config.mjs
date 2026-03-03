/** @type {import('next').NextConfig} */
if (process.env.NODE_ENV === "production" && process.env.VERCEL === "1") {
  console.warn(
    "[deploy-warning] /api/analyze expects up to 60s. Vercel Hobby caps serverless duration at 10s; large PDFs may timeout. Upgrade to Vercel Pro for reliable long-running analysis."
  );
}

const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb"
    }
  }
};

export default nextConfig;
