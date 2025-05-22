import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**', 
      },
      {
        protocol: 'https',
        hostname: 'images.hive.blog',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.DTube.top', // Common DTube image proxy
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.ecency.com', // Common Ecency image proxy
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'files.peakd.com', // Common PeakD image hosting
        port: '',
        pathname: '/**',
      },
      // Add more patterns if other image sources are common on Hive
      // For IPFS, you might need a pattern for your preferred gateway
      // e.g. { protocol: 'https', hostname: 'ipfs.io', pathname: '/ipfs/**' }
    ],
  },
};

export default nextConfig;
