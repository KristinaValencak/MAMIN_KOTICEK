import { createContext, useContext } from "react";

export const MobileShellContext = createContext({
  openGlobalSearch: () => {},
});

export function useMobileShell() {
  return useContext(MobileShellContext);
}
