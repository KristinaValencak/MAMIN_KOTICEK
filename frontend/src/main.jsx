import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/custom.css'
import App from './App.jsx'
import { ApiAlertModalProvider } from './context/ApiAlertModalContext.jsx'
import { ChakraProvider } from '@chakra-ui/react'
import { ColorModeScript, extendTheme } from '@chakra-ui/react'
import { BrowserRouter } from 'react-router-dom'
import { installFetchAuthGuard } from "./utils/installFetchAuthGuard";

const config = {
  initialColorMode: "light",
  useSystemColorMode: false,
}

const focusRing = "0 0 0 3px rgba(236, 95, 140, 0.38)";

const theme = extendTheme({
  config,
  styles: {
    global: {
      "*:focus-visible": {
        outline: "none",
        boxShadow: focusRing,
      },
    },
  },
  colors: {
    brand: {
      white: "#FFFFFF",
      50: "rgba(236, 95, 140, 0.05)",
      100: "rgba(236, 95, 140, 0.1)",
      200: "rgba(236, 95, 140, 0.2)",
      300: "rgba(236, 95, 140, 0.3)",
      400: "#F48FB1",
      500: "#EC5F8C",
      600: "#D94B8C",
      700: "#C73A7A",
      800: "#B82A6A",
      900: "#A61A5A",
    },
    dark: {
      500: "#333333",
    },
    
  },
  fonts: {
    heading: `'Nunito', system-ui, sans-serif`,
    body: `'Nunito', system-ui, sans-serif`,
  },
  
  components: {
    Button: {
      defaultProps: {
        colorScheme: "brand",
      },
      baseStyle: {
        _focusVisible: {
          boxShadow: focusRing,
        },
      },
    },
    IconButton: {
      baseStyle: {
        _focusVisible: {
          boxShadow: focusRing,
        },
      },
    },
    CloseButton: {
      baseStyle: {
        _focusVisible: {
          boxShadow: focusRing,
        },
      },
    },
  },
})

installFetchAuthGuard();




createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ColorModeScript initialColorMode={theme.config.initialColorMode} />
    <ChakraProvider theme={theme}>
      <ApiAlertModalProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ApiAlertModalProvider>
    </ChakraProvider>
  </StrictMode>,
)
