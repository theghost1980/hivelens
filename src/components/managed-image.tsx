'use client';

import NextImage, { type ImageProps as NextImageProps } from 'next/image';
import { useEffect, useState, useMemo } from 'react';
import { configuredHostnames, reportUnconfiguredHostname, getHostnameFromUrl } from '@/lib/image-config';

interface ManagedImageProps extends NextImageProps {}

const ManagedImage: React.FC<ManagedImageProps> = (props) => {
  const { src, unoptimized: propUnoptimized, ...rest } = props;
  const [useUnoptimizedOverride, setUseUnoptimizedOverride] = useState(false);
  const [isValidSrc, setIsValidSrc] = useState(true);

  const hostname = useMemo(() => {
    if (typeof src === 'string' && src.startsWith('http')) {
      return getHostnameFromUrl(src);
    }
    return null;
  }, [src]);

  useEffect(() => {
    if (typeof src === 'string') {
      if (hostname) {
        setIsValidSrc(true);
        let isKnown = configuredHostnames.includes(hostname);

        if (!isKnown) {
          isKnown = configuredHostnames.some(configured => {
            if (configured.startsWith('*.')) {
              const baseDomain = configured.substring(2);
              return hostname.endsWith(`.${baseDomain}`) || hostname === baseDomain;
            }
            return false;
          });
        }
       
        if (!isKnown && !propUnoptimized) {
          reportUnconfiguredHostname(hostname);
        }
      } else if (src.startsWith('http')) {
        console.warn(`[ManagedImage] Could not parse hostname from src: ${src}`);
        setIsValidSrc(false);
      } else if (!src.startsWith('/')) {
         // Could be a data URI or other scheme, let NextImage handle it or log if problematic.
      }
    } else {
      setIsValidSrc(true);
    }
  }, [src, hostname, propUnoptimized]);

  if (!isValidSrc && typeof src === 'string' && !src.startsWith('/')) {
    return null;
  }

  const shouldBeUnoptimized = propUnoptimized || (hostname !== null);

 return <NextImage src={src} {...rest} unoptimized={shouldBeUnoptimized} />;
};

export default ManagedImage;