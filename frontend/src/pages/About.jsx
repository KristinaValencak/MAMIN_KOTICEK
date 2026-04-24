import { Box } from "@chakra-ui/react";
import React from "react";
import AboutHero from "../components/About/AboutHero";
import AboutIntro from "../components/About/AboutIntro";
import WhatWeOffer from "../components/About/WhatWeOffer";
import PostingGuidelines from "../components/About/PostingGuidelines";
import FounderStory from "../components/About/FounderStory";
import TrustAndSafety from "../components/About/TrustAndSafety";
import Footer from "../components/Footer/Footer";
import Contact from "../components/Contact/Contact";

const About = () => {
  return (
    <Box minH="100dvh">
      <AboutHero />
      <AboutIntro />
      <WhatWeOffer />
      <PostingGuidelines />
      <FounderStory />
      <TrustAndSafety />
      <Contact variant="modal" />
      <Footer variant="forum" />
    </Box>
  );
};

export default About;
