export const configuredHostnames: string[] = [
  "placehold.co",
  "images.hive.blog",
  "img.DTube.top",
  "images.ecency.com",
  "files.peakd.com",
  "media.giphy.com",
  "media1.giphy.com",
  "ipfs-3speak.b-cdn.net",
  "cdn.liketu.com",
  "cdn.steemitimages.com",
  "steemitimages.com",
  "usermedia.actifit.io",
  "img.youtube.com",
  "waivio.nyc3.digitaloceanspaces.com",
  "buymeberries.com",
  "i.ibb.co",
  "i.imgflip.com",
  "i.postimg.cc",
  "img.blurt.world",
  "images.pexels.com",
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "ipfs.skatehive.app",
  "live.staticflickr.com",
  "lh7-rt.googleusercontent.com",
  "sun9-27.userapi.com",
  "sun9-60.userapi.com",
  "sun9-28.userapi.com",
  "*.userapi.com",
  "somoskudasai.com",
  "i.imgur.com",
  "media.tenor.com",
  "d36mxiodymuqjm.cloudfront.net",
  "actifit.s3.us-east-1.amazonaws.com",
  "img.esteem.ws",
  "img.esteem.app",
  "img.travelfeed.io",
  "files.steempeak.com",
  "a.storyblok.com",
  "somoskudasai.com",
  "ecency.com",
  "cdn.pixabay.com",
  "pixabay.com",
  "cdn.rcimg.net",
  "www.thelastamericanvagabond.com",
  "ethanwiner.com",
  "img.leopedia.io",
  "direct2recovery.com",
  "i.giphy.com",
  "gifdb.com",
  "hips.hearstapps.com",
  "image.myanimelist.net",
  "cdn.steemitstageimages.com",
  "sunwinivn.com",
  "worldmappin.com",
  "pics.filmaffinity.com",
  "gioghiblimovie.carrd.co",
  "static.wikia.nocookie.net",
  "cdn.buymeacoffee.com",
  "st.depositphotos.com",
  "resources.safecreative.org",
  "s2.loli.net",
  "www.cinemas-na.fr",
  "cryptoadventure.com",
  "external-content.duckduckgo.com",
  "focus.ua",
  "www.themoviedb.org",
  "static1.colliderimages.com",
  "laspina.org",
  "media.discordapp.net",
  "www.iglesiabiblicadelagracia.com",
  "media0.giphy.com",
  "tenor.com",
  "images.pexels.com",
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "cdn.discordapp.com",
  "www.ledgerwallet.com",
  "web.archive.org",
  "img.freepik.com",
  "2.bp.blogspot.com",
  "images.ctfassets.net",
  "arcange.eu",
  "images2.imgbox.com",
  "www.travelchinaguide.com",
  "leadsleap.com",
  "trafficadbar.com",
  "freeadvertisingforyou.com",
  "infinitytrafficboost.com",
  "www.easyhits4u.com",
  "books2read-prod.s3.amazonaws.com",
  "a2.espncdn.com",
  "miro.medium.com",
  "images.cointelegraph.com",
  "blogger.googleusercontent.com",
  "i.ytimg.com",
  "st3.depositphotos.com",
  "3.bp.blogspot.com",
  "1.bp.blogspot.com",
  "news.cnrs.fr",
  "amenapps.com",
  "d3tbgcbuarzgxm.cloudfront.net",
  "freelifeincome.com",
  "images.fineartamerica.com",
  "imageshack.com",
  "images-na.ssl-images-amazon.com",
  "historietas.net",
  "images.app.goo.gl",
  "halloweenyearround.wordpress.com",
  "mutantreviewersmovies.com",
  "falconmovies.wordpress.com",
  "goonfleet.com",
  "i.pinimg.com",
  "en.wikipedia.org",
  "scx2.b-cdn.net",
  "64.media.tumblr.com",
  "perapalace.com",
  "flexappealfitnessca.wordpress.com",
  "d2e5ushqwiltxm.cloudfront.net",
  "huahin.locality.guide",
  "i0.wp.com",
  "www.profesionalreview.com",
  "mp1st.com",
  "locosxlosjuegos.com",
  "assetsio.gnwcdn.com",
  "i.redd.it",
  "pa1.narvii.com",
  "knaufautomotive.com",
  "cdn.shortpixel.ai",
  "preview.redd.it",
  "el.sg",
  "www.diainternacionalde.com",
];

const newlyDetectedUnconfiguredHostnames = new Set<string>();

export function reportUnconfiguredHostname(hostname: string): void {
  let isKnown = configuredHostnames.includes(hostname);

  if (!isKnown) {
    isKnown = configuredHostnames.some((configured) => {
      if (configured.startsWith("*.")) {
        const baseDomain = configured.substring(2);
        return hostname.endsWith(`.${baseDomain}`) || hostname === baseDomain;
      }
      return false;
    });
  }

  if (!isKnown && !newlyDetectedUnconfiguredHostnames.has(hostname)) {
    newlyDetectedUnconfiguredHostnames.add(hostname);
    console.warn(
      `[ImageHandler] Potentially unconfigured hostname: ${hostname}. ` +
        `Image will be loaded unoptimized. Add to next.config.js and image-config.ts if legitimate.`
    );
  }
}

export function getNewlyDetectedHostnames(): string[] {
  return Array.from(newlyDetectedUnconfiguredHostnames);
}

export function logAllDetectedHostnames(): void {
  const hostnames = getNewlyDetectedHostnames();
  if (hostnames.length > 0) {
    console.log(
      "--- Potentially Unconfigured Hostnames Detected This Session ---"
    );
    hostnames.forEach((h) => console.log(h));
    console.log(
      "-------------------------------------------------------------"
    );
    console.log(
      "Consider adding these to next.config.js (images.remotePatterns) and src/lib/image-config.ts (configuredHostnames array)."
    );
    newlyDetectedUnconfiguredHostnames.clear();
  } else {
    console.log(
      "[ImageHandler] No new unconfigured hostnames detected this session."
    );
  }
}

export function getHostnameFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch (e) {
    console.error(
      `[ImageHandler] Invalid URL string for hostname extraction: ${url}`
    );
    return null;
  }
}
