import { Box, Container } from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import Footer from "../Footer/Footer";
import LoginForm from "../auth/LoginForm";

const Login = () => {
  const navigate = useNavigate();

  return (
    <Box
      minH="100vh"
      display="flex"
      flexDirection="column"
      position="relative"
      overflow="hidden"
      bgGradient="linear(to-br, #fafafa, #f5f5f5, #fafafa)"
    >
      <Container maxW="450px" flex="1" display="flex" alignItems="center" py={{ base: 12, md: 20 }} position="relative" zIndex={1}>
        <LoginForm showBranding navigate={navigate} />
      </Container>
    </Box>
  );
};

export default Login;
