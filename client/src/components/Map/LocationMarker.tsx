function LocationMarker() {
  const [position, setPosition] = useState<[number, number] | null>(null);
  const map = useMap();

  useEffect(() => {
    map.locate().on("locationfound", function (e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
      map.flyTo(e.latlng, map.getZoom());
    }).on("locationerror", function(e) {
      console.log("Location error:", e.message);
      // Use default Netherlands center if location not found
      const defaultPos: [number, number] = [52.1326, 5.2913];
      setPosition(defaultPos);
      map.flyTo(defaultPos, map.getZoom());
    });
  }, [map]);
}