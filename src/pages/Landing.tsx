import Nav from '../components/Nav'
import Hero from '../components/Hero'
import StatPillars from '../components/StatPillars'
import HowItWorks from '../components/HowItWorks'
import FeatureShowcase from '../components/FeatureShowcase'
import WhyMeridian from '../components/WhyMeridian'
import RoadmapTimeline from '../components/RoadmapTimeline'
import BuiltOnArc from '../components/BuiltOnArc'
import Testimonials from '../components/Testimonials'
import Newsletter from '../components/Newsletter'
import Footer from '../components/Footer'

export default function Landing() {
  return (
    <>
      <Nav />
      <Hero />
      <StatPillars />
      <HowItWorks />
      <FeatureShowcase />
      <WhyMeridian />
      <RoadmapTimeline />
      <BuiltOnArc />
      <Testimonials />
      <Newsletter />
      <Footer />
    </>
  )
}
