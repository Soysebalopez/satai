export default function MapaLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        href="https://api.mapbox.com/mapbox-gl-js/v3.12.0/mapbox-gl.css"
        rel="stylesheet"
      />
      {children}
    </>
  );
}
