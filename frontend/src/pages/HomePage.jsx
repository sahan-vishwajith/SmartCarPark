import ParkingMap from "../components/ParkingMap";

export default function HomePage() {
  return (
    <>
      <ParkingMap />
      <main className="hero">
        <h1 className="heroTitle">
          Sri Lanka&apos;s Award Winning
          <br />
          <span className="heroTitleDim">Digital Parking Service Provider</span>
        </h1>

        <p className="heroSubtitle">
          Discover smarter, hassle-free parking solutions, ushering in the future of parking.
        </p>

        <div className="heroActions">
          <button className="primaryBtn">Reach our Specialist</button>
          <button className="secondaryBtn">Learn More</button>
        </div>
      </main>
    </>
  );
}