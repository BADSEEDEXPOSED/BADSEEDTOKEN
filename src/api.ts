const isBadseedLivePath =
    typeof window !== "undefined" &&
    window.location.hostname === "badseed.exposed" &&
    window.location.pathname.startsWith("/live");

export const functionUrl = (name: string) =>
    isBadseedLivePath
        ? `/live-api/${name}`
        : `/.netlify/functions/${name}`;

export const publicAssetUrl = (name: string) =>
    isBadseedLivePath ? `/live/${name}` : `/${name}`;
