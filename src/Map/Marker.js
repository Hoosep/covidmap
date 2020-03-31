import React from "react";
import { CircleMarker, Tooltip, Popup } from "react-leaflet";

const Marker = (coordinates, rowId, color, text, size, val, name, markerOffset, type, opacity) => {
  if(size > 0 && name !== "US, US") {
    return (
      // bubble
      <CircleMarker
        className={type}
        key={type + "_" + rowId}
        style={this.state.chart === "pie" ? {display: "block"} : {display: "none"}}
        center={[coordinates[1], coordinates[0]]}
        fillColor={color}
        radius={size && size > 0 ? Math.sqrt(size) * this.state.factor : 0}
        opacity={0}
        fillOpacity={opacity}
      >
        <Tooltip
          direction="bottom"
          offset={[0, 20]}
          opacity={1}
          interactive={true}>
          {this.tooltip(name, rowId)}
        </Tooltip>
        <Popup>
          {this.tooltip(name, rowId)}
        </Popup>
      </CircleMarker>
    );
  }
  return "";
};

export default Marker;