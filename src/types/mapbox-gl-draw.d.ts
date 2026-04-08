declare module "@mapbox/mapbox-gl-draw" {
  import type { IControl } from "mapbox-gl";

  interface DrawOptions {
    displayControlsDefault?: boolean;
    controls?: {
      point?: boolean;
      line_string?: boolean;
      polygon?: boolean;
      trash?: boolean;
      combine_features?: boolean;
      uncombine_features?: boolean;
    };
    defaultMode?: string;
  }

  class MapboxDraw implements IControl {
    constructor(options?: DrawOptions);
    onAdd(map: mapboxgl.Map): HTMLElement;
    onRemove(): void;
    getAll(): GeoJSON.FeatureCollection;
    deleteAll(): this;
    add(geojson: GeoJSON.Feature | GeoJSON.FeatureCollection): string[];
    delete(ids: string | string[]): this;
  }

  export default MapboxDraw;
}
