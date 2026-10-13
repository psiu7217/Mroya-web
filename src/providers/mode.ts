// Guard a mistakenly uploaded Design bundle as well as the normal build-time separation.
export function isProductionHost(hostname: string): boolean {
  return ['app.heymroya.com', 'api.heymroya.com', 'heymroya.com', 'www.heymroya.com'].includes(hostname.toLowerCase().replace(/\.$/, ''));
}
