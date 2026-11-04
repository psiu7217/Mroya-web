import {useEffect, useState} from 'react';
import {startVersionChecks} from './frontendVersion';

declare const __MROYA_BUILD_ID__: string;

export function useFrontendUpdate() {
  const [available, setAvailable] = useState(false);
  useEffect(() => startVersionChecks(__MROYA_BUILD_ID__, () => setAvailable(true)), []);
  return available;
}
