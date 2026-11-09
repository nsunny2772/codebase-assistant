import { useEffect, useRef } from "react";

export const useMountedRef = () => {
  const mounted = useRef(true);
  const handleUnmount = () => {
    mounted.current = false;
  };
  const handleMount = () => {
    mounted.current = true;
    return handleUnmount;
  };
  useEffect(handleMount, []);
  return mounted;
};
