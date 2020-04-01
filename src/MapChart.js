import React, { memo, Fragment } from "react";
import { Map, TileLayer, Tooltip, Popup,
         CircleMarker, LayerGroup } from "react-leaflet";
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faTimes,
  faLightbulb,
  faUsers,
  faBars,
  faProcedures,
  faHeartbeat,
  faHeartBroken,
  faSkull,
  faBiohazard,
  faStopCircle,
  faPauseCircle,
  faQuestion,
  faDatabase,
  faBalanceScale, 
  faBolt,
  faStepBackward,
  faStepForward
} from '@fortawesome/free-solid-svg-icons';
import { faPlayCircle } from '@fortawesome/free-regular-svg-icons';

import Papa from "papaparse";
import Form from 'react-bootstrap/Form';
import Badge from 'react-bootstrap/Badge';
import ReactBootstrapSlider from "react-bootstrap-slider";

// Data
import * as Testing from "./Shared/Data/TestingRates";
import * as Population from "./Shared/Data/Population";

// Utils
import { rounded, sleep } from "./Shared/Utils";

const ONE_M = 1000000;

class MapChart extends Map {
  constructor(props) {
    
    super(props);
    let minimized = false;
    let zoom = 2;
    let lat = 14.00;
    let lng = 0;
    if(window.innerWidth <= 426) {
      minimized = !minimized;
      zoom = 1.5;
      lat = 10;
      lng = -90.00;
    }
    const urlParams = new URLSearchParams(window.location.search);
    const quedateEnTuPutaCasa = urlParams.get('quedateEnTuPutaCasa');
    console.log("quedateEnTuPutaCasa", quedateEnTuPutaCasa);
    this.state = {
      setTotConf: props.setTotConf,
      setTotRec: props.setTotRec,
      setTotDead: props.setTotDead,
      chart: "pie",
      factor: 60,
      width: 2,
      quedateEnTuPutaCasa,
      logmode: true,
      momentum: "none",
      ppmmode: false,
      minimized,
      testmode: true,
      testscale: 0,
      dayOffset: 0,
      playmode: false,
      recoverydays: 12,
      mapstyle: 1,
      mapSelected: "Normal",
      datasource: "jh2",
      recoveryMode: false,
      maxSize: 67021,
      speedMarkers: 300,

      showModal: false,
      modalTotDeads: 0,
      modalTotConfirmed: 0,
      starbucksDisabledButton: true,

      // leaflet map
      lat,
      lng,
      zoom
    };

    this.map = null;

    this.deathsByRowId = {};
    this.recoveredAbsByRowId = {};
    this.deathsAbsByRowId = {};

    this.confirmed = [];
    this.recovered = [];
    this.deaths = [];
    this.projected = []; /* this will be local_confirmed_rate * avg_test_rate / local_test_rate */

    this.totConf = 0;
    this.totRec = 0;
    this.totDead = 0;

  }

  componentDidMount() {
    this.reload();
  }

  componentDidUpdate (prevProps) {
      this.updateLeafletElement(prevProps, this.props);
      const layers = this.map.leafletElement._layers;

      // bring to front one by one
      Object.values(layers).map((layer) => {
        if(layer.options.className ==="projected") {
          layer.bringToFront();
        }
      });

      Object.values(layers).map((layer) => {
        if(layer.options.className ==="confirmed") {
          layer.bringToFront();
        }
      });

      Object.values(layers).map((layer) => {
        if(layer.options.className ==="recovered") {
          layer.bringToFront();
        }
      });

      Object.values(layers).map((layer) => {
        if(layer.options.className ==="deceased") {
          layer.bringToFront();
        }
      });

  }

  reset = () => {
    this.deathsByRowId = {};
    this.recoveredAbsByRowId = {};
    this.deathsAbsByRowId = {};

    this.confirmed = [];
    this.recovered = [];
    this.deaths = [];
    this.projected = []; /* this will be local_confirmed_rate * avg_test_rate / local_test_rate */

    this.totConf = 0;
    this.totRec = 0;
    this.totDead = 0;

    this.state.setTotConf(this.totConf);
    this.state.modalTotDeads = 0;
    this.state.modalTotConfirmed = 0;
    if(this.state.recoveryMode) {
      this.state.setTotRec(this.totRec);
    } else {
      this.state.setTotRec("-");
    }
    this.state.setTotDead(this.totDead);
  };

  reload = () => {
    let that = this;
    that.totConf = 0;
    that.totRec = 0;
    that.totDead = 0;
    that.deathsByRowId = {};
    that.recoveredAbsByRowId = {};
    that.deathsAbsByRowId = {};

    let confirmedDataSource = null;
    let deceasedDataSource = null;
    switch(that.state.datasource) {
      case "jh2":
        confirmedDataSource = "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv";
        deceasedDataSource = "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_global.csv"
        break;
      default:
        confirmedDataSource = "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_confirmed_global.csv";
        deceasedDataSource = "https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_time_series/time_series_covid19_deaths_global.csv"
        break;
    }

    Papa.parse(confirmedDataSource, {
      download: true,
      complete: async function(results) {
        // confirmed
        that.confirmed = [];
        let skipRow = true;
        let minSize = 0;
        let rowId = 0;
        let avgTested = 0;
        let avgPopulation = 0;
        let countTested = 0;
        let countPopulation = 0;
        for(let data of results.data) {
          if(skipRow) {
            skipRow = false;
            continue;
          }
          if(data.length === 1 ) {
              continue;
          }
          let size = "";
          let sizeMin1 = "";
          let sizeMin3 = "";
          let sizeMin7 = "";
          
          let idx = data.length - 1 + that.state.dayOffset;
          size = data[idx];
          sizeMin1 = data[idx - 1];
          sizeMin3 = data[idx - 3];
          sizeMin7 = data[idx - 7];
          if(size==="") {
            size = 0;
          }
          if(sizeMin1==="") {
            sizeMin1 = 0;
          }
          if(sizeMin3==="") {
            sizeMin3 = 0;
          }
          if(sizeMin7==="") {
            sizeMin7 = 0;
          }
          size = Number(size);
          sizeMin1 = Number(sizeMin1);
          sizeMin3 = Number(sizeMin3);
          sizeMin7 = Number(sizeMin7);
          if(size > that.state.maxSize) {
            that.state.maxSize = size;
          }
          let marker = {
            markerOffset: 0,
            name: (data[0] ? data[0] + ", " + data[1] : data[1]) ? (data[0] ? data[0] + ", " + data[1] : data[1]) : "",
            coordinates: [data[3], data[2]],
            size: size,
            sizeMin1: sizeMin1,
            sizeMin3: sizeMin3,
            sizeMin7: sizeMin7,
            val: size,
            rowId: rowId,
            valMin1: size - sizeMin1,
            valMin3: size - sizeMin3,
            valMin7: size - sizeMin7
          };
          that.totConf += size;
          that.confirmed.push(marker);

          // compute total tested and total population
          if(Testing.RATES[marker.name] && Population.ABSOLUTE[marker.name]) {
            avgTested += Testing.RATES[marker.name];
            avgPopulation += Population.ABSOLUTE[marker.name];
            countTested++;
            countPopulation++;
          }
          rowId++;
        }
        avgTested /= countTested;
        avgPopulation /= countPopulation;
        that.state.setTotConf(that.totConf);
        that.state.modalTotConfirmed = that.totConf;
        for(let i = 0; i < that.confirmed.length; i++) {
          that.confirmed[i].size = (that.confirmed[i].size - minSize) / (that.state.maxSize - minSize);
          that.confirmed[i].momentumLast1 = that.confirmed[i].size - (that.confirmed[i].sizeMin1 - minSize) / (that.state.maxSize - minSize);
          that.confirmed[i].momentumLast3 = that.confirmed[i].size - (that.confirmed[i].sizeMin3 - minSize) / (that.state.maxSize - minSize);
          that.confirmed[i].momentumLast7 = that.confirmed[i].size - (that.confirmed[i].sizeMin7 - minSize) / (that.state.maxSize - minSize);
        }

        // projected
        let globalTestRate = avgTested / avgPopulation;
        that.projected = [];
        skipRow = true;
        rowId = 0;
        for(let data of results.data) {
          if(skipRow) {
            skipRow = false;
            continue;
          }
          if(data.length === 1 ) {
              continue;
          }
          let size = that.confirmed[rowId].size;
          let val = that.confirmed[rowId].val;
          if(Testing.RATES[that.confirmed[rowId].name] && Population.ABSOLUTE[that.confirmed[rowId].name]) {
            let localTestRate = Testing.RATES[that.confirmed[rowId].name] / Population.ABSOLUTE[that.confirmed[rowId].name];
            let inverseTestFactor = globalTestRate / localTestRate;
            size = size * inverseTestFactor;
            val = val * inverseTestFactor;
          } else {
            size = 0;
          }
          let marker = {
            markerOffset: 0,
            name: that.confirmed[rowId].name,
            coordinates: that.confirmed[rowId].coordinates,
            size: size,
            val: val,
            rowId: that.confirmed[rowId].rowId,
          };
          that.projected.push(marker);
          rowId++;
        }
        if(that.state.datasource === "jh2") {
          that.recovered = [];
          let skipRow = true;
          let minSize = 0;
          let rowId = 0;
          for (let data of results.data) {
            if (skipRow) {
              skipRow = false;
              continue;
            }
            if(data.length === 1 ) {
              continue;
            }
            let size = "";
            let sizeMin1 = "";
            let sizeMin3 = "";
            let sizeMin7 = "";
            let idx = data.length - 1 + that.state.dayOffset;
            while(that.deaths.length < idx) {
              await sleep(5000);
            }
            size =      Math.max(0, data[Math.max(0, idx     - that.state.recoverydays)] - that.deaths[rowId].val);
            sizeMin1 =  Math.max(data[Math.max(0, idx - 1 - that.state.recoverydays)] - that.deaths[rowId].valMin1);
            sizeMin3 =  Math.max(data[Math.max(0, idx - 3 - that.state.recoverydays)] - that.deaths[rowId].valMin3);
            sizeMin7 =  Math.max(data[Math.max(0, idx - 7 - that.state.recoverydays)] - that.deaths[rowId].valMin7);
            if (size === "") {
              size = 0;
            }
            if (sizeMin1 === "") {
              sizeMin1 = 0;
            }
            if (sizeMin3 === "") {
              sizeMin3 = 0;
            }
            if (sizeMin7 === "") {
              sizeMin7 = 0;
            }
            size = Number(size);
            sizeMin1 = Number(sizeMin1);
            sizeMin3 = Number(sizeMin3);
            sizeMin7 = Number(sizeMin7);
            if (size > that.state.maxSize) {
              that.state.maxSize = size;
            }
            let marker = {
              markerOffset: 0,
              name: data[0] ? data[0] + ", " + data[1] : data[1],
              coordinates: [data[3], data[2]],
              size: size,
              sizeMin1: sizeMin1,
              sizeMin3: sizeMin3,
              sizeMin7: sizeMin7,
              val: size,
              rowId: rowId,
              valMin1: size - sizeMin1,
              valMin3: size - sizeMin3,
              valMin7: size - sizeMin7
            };
            that.totRec += size;
            that.recovered.push(marker);
            rowId++;
          }
          
          that.state.setTotRec(0);
          for (let i = 0; i < that.recovered.length; i++) {
            that.recoveredAbsByRowId[that.recovered[i].rowId] = that.recovered[i].size;
            that.recovered[i].size = (that.recovered[i].size - minSize) / (that.state.maxSize - minSize);
            that.recovered[i].momentumLast1 = that.recovered[i].size - (that.recovered[i].sizeMin1 - minSize) / (that.state.maxSize - minSize);
            that.recovered[i].momentumLast3 = that.recovered[i].size - (that.recovered[i].sizeMin3 - minSize) / (that.state.maxSize - minSize);
            that.recovered[i].momentumLast7 = that.recovered[i].size - (that.recovered[i].sizeMin7 - minSize) / (that.state.maxSize - minSize);
          }
        }
        that.setState({});
      }
    });

    Papa.parse(deceasedDataSource, {
      download: true,
      complete: function(results) {
        that.deaths = [];
        let skipRow = true;
        let minSize = 0;
        let rowId = 0;
        for(let data of results.data) {
          if(skipRow) {
            skipRow = false;
            continue;
          }
          if(data.length === 1 ) {
              continue;
            }
          let size = "";
          let sizeMin1 = "";
          let sizeMin3 = "";
          let sizeMin7 = "";
          let idx = data.length - 1 + that.state.dayOffset;
          size = data[idx];
          sizeMin1 = data[idx - 1];
          sizeMin3 = data[idx - 3];
          sizeMin7 = data[idx - 7];
          if(size==="") {
            size = 0;
          }
          if(sizeMin1==="") {
            sizeMin1 = 0;
          }
          if(sizeMin3==="") {
            sizeMin3 = 0;
          }
          if(sizeMin7==="") {
            sizeMin7 = 0;
          }
          size = Number(size);
          sizeMin1 = Number(sizeMin1);
          sizeMin3 = Number(sizeMin3);
          sizeMin7 = Number(sizeMin7);
          if(size > that.state.maxSize) {
            that.state.maxSize = size;
          }
          let marker = {
            markerOffset: 0,
            name: data[0] ? data[0] + ", " + data[1] : data[1],
            coordinates: [data[3], data[2]],
            size: size,
            sizeMin1: sizeMin1,
            sizeMin3: sizeMin3,
            sizeMin7: sizeMin7,
            val: size,
            rowId: rowId,
            valMin1: size - sizeMin1,
            valMin3: size - sizeMin3,
            valMin7: size - sizeMin7
          };
          that.totDead += size;
          that.deaths.push(marker);
          rowId++;
        }
        that.state.setTotDead(that.totDead);
        that.state.modalTotDeads = that.totDead;
        for(let i = 0; i < that.deaths.length; i++) {
          
          that.deathsAbsByRowId[that.deaths[i].rowId] = that.deaths[i].size;
          that.deaths[i].size = (that.deaths[i].size - minSize) / (that.state.maxSize - minSize);
          that.deathsByRowId[that.deaths[i].rowId] = that.deaths[i].size;
          that.deaths[i].momentumLast1 = that.deaths[i].size - (that.deaths[i].sizeMin1 - minSize) / (that.state.maxSize - minSize);
          that.deaths[i].momentumLast3 = that.deaths[i].size - (that.deaths[i].sizeMin3 - minSize) / (that.state.maxSize - minSize);
          that.deaths[i].momentumLast7 = that.deaths[i].size - (that.deaths[i].sizeMin7 - minSize) / (that.state.maxSize - minSize);
        }
        that.setState({});
      }
    });
  };

  render() {
    let that = this;
    let shownDate = new Date();
    shownDate.setDate(shownDate.getDate() + this.state.dayOffset);

    return (
      <Fragment>
        <div className={"small controls" + (that.state.minimized ? " minimized" : "")}>
      
          <button
            hidden={that.state.minimized}
            className={"btn-collapse"}
            onClick={() => {that.setState({minimized: true})}}>
            <FontAwesomeIcon icon={faTimes}/>
          </button>

          <button
            hidden={!that.state.minimized}
            className={"btn-collapse"}
            onClick={() => {that.setState({minimized: false})}}>
            <FontAwesomeIcon icon={faBars} style={{ fontSize: "2em"}}/>
            <span className="d-inline-block mx-2" style={{
              top: "-3px",
              position: "relative",
              fontSize: "1.2em"
            }}>Open</span>
          </button>

          <div hidden={that.state.minimized}>
            {/*<span className="small text-muted">Mode:</span>
            <Form.Control title={"Live mode: Show live data (updated daily). Change: Show increase/decrease in numbers since last 1, 3 or 7 days."} value={that.state.momentum} style={{lineHeight: "12px", padding: "0px", fontSize: "12px", height: "24px"}} size="sm" as="select" onChange={(e) => {that.setState({momentum: e.nativeEvent.target.value, chart: "pie", testmode: false, testscale: 0});}}>
              <option value="none">Live</option>
              <option value="last1">Change since last 24 hours</option>
              <option value="last3">Change since last 3 days</option>
              <option value="last7">Change since last 7 days</option>
            </Form.Control>
            */}
            


            {
              that.state.momentum === "none" && !that.state.playmode &&
              <Fragment>
                {/*<span className="small text-muted mr-2">Project testing rates</span>
                <FontAwesomeIcon size={"xs"} icon={faQuestion} title={"Display blue bubbles projecting how many confirmed cases there might be if local testing rate was coinciding with global average."}/>
                <Form.Control
                  value={this.state.testscale}
                  style={{lineHeight: "12px", padding: "0px", fontSize: "12px", height: "24px"}}
                  size="sm"
                  as="select"
                  onChange={(e) => {
                    this.setState({ testscale: e.target.value, testmode: true });
                    }
                  }>
                    <option value={0}>Off</option>
                    <option value={1}>Global AVG</option>
                    <option value={2}>x2</option>
                    <option value={3}>x3</option>
                </Form.Control>
                */}
                <span className="small text-muted">Speed</span>
                <Form.Control
                  value={this.state.speedMarkers}
                  style={{lineHeight: "12px", padding: "0px", fontSize: "12px", height: "24px"}}
                  size="sm"
                  as="select"
                  onChange={(e) => {
                    this.setState({ speedMarkers: e.target.value });
                    }
                  }>
                    <option value={7000}>Slow</option>
                    <option value={300}>Normal</option>
                    <option value={100}>Fast</option>
                </Form.Control>
              </Fragment>
            }


            {
              this.state.recoveryMode && that.state.datasource === "jh2" &&
              [
                <span className="small text-muted mr-2">Number of days to recover:</span>,
                <FontAwesomeIcon size={"xs"} icon={faQuestion}
                                title={"Johns Hopkins v2 does not report recovery data. Therefore we estimate recovery data by assuming patients recover after X days on average. This is early work and may be revised in line with new research."} />,
                <br/>,
                <ReactBootstrapSlider
                    ticks={[6, 9, 12, 15, 18]}
                    ticks_labels={["6", "9", "12", "15", "18"]}
                    value={this.state.recoverydays}
                    change={e => {
                      this.setState({recoverydays: e.target.value});
                      this.reload();
                    }}
                    step={1}
                    max={18}
                    min={6}
                ></ReactBootstrapSlider>
              ]
            }

            <span className="small text-muted d-block">Map information</span>

            <Form.Control
              value={that.state.mapstyle}
              style={{lineHeight: "12px", padding: "0px", fontSize: "12px", height: "24px"}}
              size="sm"
              as="select"
              onChange={(e) => {
                  let factor = 60;
                  let index = e.nativeEvent.target.selectedIndex;
                  let text = e.nativeEvent.target[index].text
                  if(text === "Countries with more deaths") factor = 120; 
                  that.setState({
                    mapstyle: Number(e.nativeEvent.target.value),
                    factor,
                    mapSelected: text
                  });
                }
              }>
                <option value={1}>Normal</option>
                <option value={2}>Countries with more deaths</option>
                <option value={3}>Cases confirmed</option>
            </Form.Control>

            <div className="credits">
              <Badge>
                <a target="_blank" className="text-secondary" rel="noopener noreferrer" href={"https://github.com/daniel-karl/covid19-map#about"}>
                  <FontAwesomeIcon icon={faLightbulb} /> Original
                </a>
              </Badge>
              <Badge>
                <a target="_blank" className="text-secondary" rel="noopener noreferrer" href={"https://github.com/Hoosep/covidmap/blob/master/LICENSE.txt"}>
                  <FontAwesomeIcon icon={faBalanceScale} /> License
                </a>
              </Badge>
              <Badge>
                <a target="_blank" className="text-secondary" href="https://github.com/CSSEGISandData/COVID-19">
                  <FontAwesomeIcon icon={faDatabase} /> Data source
                </a>
              </Badge>
            </div>
          </div>
        </div>
        <div className="small timeline py-2">
          <Container fluid="md">
            <Row noGutters="true">
              <Col xs={12} sm={6} md={6}>
                <span className="d-inline-block text-black mx-2 py-1">
                  <b>{shownDate.toLocaleDateString()}</b>
                </span>   
                
                <button
                  className={this.state.dayOffset < 0 ? "btn btn-sm btn-dark leftTime" : "btn btn-sm btn-outline-dark leftTime"}
                  style={{height: "30px", lineHeight: "20px"}}
                  onClick={() => {
                    this.state.dayOffset = this.state.dayOffset - 1;
                    this.state.testmode = false;
                    this.reload();
                  }}>
                  <FontAwesomeIcon icon={faStepBackward}/>
                </button>

                <button
                  className={"btn btn-sm btn-secondary midTime"}
                  style={this.state.dayOffset < 0 && !this.state.playmode ? {height: "30px", lineHeight: "20px"} : {display: "none"}}
                  onClick={() => {
                    this.state.dayOffset = Math.min(0, this.state.dayOffset + 1);
                    if(this.state.dayOffset === 0) {
                      this.state.playmode = false;
                    } else {
                      this.state.testmode = false;
                    }
                    this.reload();
                  }}>
                    <FontAwesomeIcon icon={faStepForward}/>
                  </button>

                <button
                  className={"btn btn-sm btn-success play"}
                  style={{height: "30px", lineHeight: "20px"}}
                  onClick={()=>{
                    document.getElementsByClassName("todayTime")[0].style.display = "none";
                    document.getElementsByClassName("play")[0].style.display = "none";
                    document.getElementsByClassName("leftTime")[0].style.display = "none";
                    document.getElementsByClassName("midTime")[0].style.display = "none";

                    var now = new Date();
                    var startDate = new Date("January 22, 2020 00:00:00");
                    const oneDay = 24 * 60 * 60 * 1000;
                    this.state.dayOffset = - Math.round(Math.abs((now - startDate) / oneDay));
                    this.state.testmode = false;
                    this.state.playmode = true;
                    this.state.playpause = false;
                    this.state.lat = 30.5833302;
                    this.state.lng = 114.2666702;
                    this.state.zoom = 3;
                    let interval = setInterval(() => {
                      if(!that.state.playmode) {
                        clearInterval(interval);
                        this.state.dayOffset = 0;
                        this.reload();
                        return;
                      }
                      if(!this.state.playpause) {
                        this.state.dayOffset++;
                        this.reload();
                        if(this.state.dayOffset === 0) {
                          document.getElementsByClassName("todayTime")[0].style.display = "inline";
                          document.getElementsByClassName("play")[0].style.display = "inline";
                          document.getElementsByClassName("leftTime")[0].style.display = "inline";
                          document.getElementsByClassName("midTime")[0].style.display = "none";
                          this.state.playmode = false;
                          this.state.testscale = 0;

                          console.log("Last state", this.state);
                          this.setState({
                            lat: 41.8719406,
                            lng: 12.56738,
                            zoom: 2,
                            showModal: true,
                          });
                        }
                      }
                    }, this.state.speedMarkers);
                  }}>
                    Start
                  </button>       


                <button
                  className={this.state.dayOffset < 0 ? "btn btn-sm btn-outline-danger todayTime" : "btn btn-sm btn-danger todayTime"}
                  style={{height: "30px", lineHeight: "20px"}}
                  onClick={()=>{
                    this.state.dayOffset = 0;
                    this.reload();
                  }}>
                  Today
                </button>


                <button
                  className={"btn btn-sm pause " + (this.state.playpause ? "btn-success" : "btn-outline-dark")}
                  style={this.state.playmode ? {height: "30px", lineHeight: "20px"} : {display : "none"}}
                  onClick={()=>{
                    this.state.playpause = !this.state.playpause;
                    this.reload();
                  }}>
                  {
                    !this.state.playpause &&
                    [<FontAwesomeIcon icon={faPauseCircle}/>, " Pause"]
                  }
                  {
                    this.state.playpause &&
                    [<FontAwesomeIcon icon={faPlayCircle}/>, " Continue"]
                  }
                </button>

                <button
                  className={"btn btn-sm btn-danger stop"}
                  style={this.state.playmode ? {height: "30px", lineHeight: "20px"} : {display : "none"}}
                  onClick={()=>{
                    document.getElementsByClassName("todayTime")[0].style.display = "inline";
                    document.getElementsByClassName("play")[0].style.display = "inline";
                    document.getElementsByClassName("leftTime")[0].style.display = "inline";
                    document.getElementsByClassName("midTime")[0].style.display = "none";
                    this.state.playmode = false;
                    this.state.testscale = 0;
                    this.setState({
                      lat: 0,
                      lng: 0,
                      zoom: 1.99
                    });
                  }}>
                  <FontAwesomeIcon icon={faStopCircle}/> Stop
                </button>
        
              
              </Col>

              <Col xs={12} sm={6} md={6} id="infography">
                <span className="d-inline-block py-1">
                  <FontAwesomeIcon icon={faUsers}/> Population
                </span>
                <span className="d-inline-block mx-2">
                  <FontAwesomeIcon icon={faBiohazard}/> Confirmed
                </span>
                <span className="d-inline-block">
                  <FontAwesomeIcon icon={faBolt}/> Parts Per Million
                </span>
              </Col>

            </Row>

          </Container>
          
        
        </div>
        {
          that.state.momentum !== "none" &&
          <style dangerouslySetInnerHTML={{__html: `
            .hideInMomentum {
              display: none !important;
            }
            .showInMomentum {
              display: block !important;
            }
          `}} />
        }
        { that.leafletMap() }
        <Modal
          show={this.state.showModal} 
          aria-labelledby="contained-modal-title-vcenter"
          centered
          onHide={() => this.setState({ showModal: false }) }>
          <Modal.Body>
            <Badge variant="danger" className="d-block my-1 py-1" 
              style={{
                fontSize: "100%",
                borderRadius: 0,
                whiteSpace: "unset"
              }}>
              <FontAwesomeIcon icon={faSkull}/> {new Intl.NumberFormat().format(this.state.modalTotDeads)} deaths / muertes
            </Badge>
            <Badge variant="secondary" className="d-block my-1 py-1" 
              style={{
                fontSize: "100%",
                borderRadius: 0,
                whiteSpace: "unset"
              }}>
              <FontAwesomeIcon icon={faBiohazard}/> {new Intl.NumberFormat().format(this.state.modalTotConfirmed)} confirmed / confirmados
            </Badge>

            {
              this.state.quedateEnTuPutaCasa
              ? (
                <Fragment>
                  <Form.Check
                    type="checkbox"
                    className="mt-4 mb-1 text-danger"
                    onChange={(e) => {
                      console.log(e.target.checked);
                      this.setState({
                        starbucksDisabledButton: !e.target.checked
                      })
                    }} 
                    label={`I've understood that pandemy is not a game. He entendido que la pandemia no es un juego.`}
                    style={{
                      fontSize: "0.6em",
                      whiteSpace: "pre-wrap"
                    }} />
                  <Button
                    variant="success"
                    disabled={this.state.starbucksDisabledButton}
                    href="https://www.youtube.com/watch?v=FWwLZN3aRL0">
                    <span className="d-block">
                      OBTENER CÓDIGO DE OXXO O STARBUCKS
                    </span>
                  </Button>
                </Fragment>
              ) : null
            }
          </Modal.Body>
        </Modal>
    </Fragment>
    );
  }

  leafletMap = () => {
    const { mapstyle, lat, lng, zoom } = this.state;
    let urlMap = "";
    if(mapstyle === 1 || mapstyle === 3) urlMap = "https://{s}.tile.osm.org/{z}/{x}/{y}.png";
    else urlMap = "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png";
    
    const position = [lat, lng];
    return (
      <Map ref={(ref) => { this.map = ref}} center={position} zoom={zoom} zoomControl={false}>
        <TileLayer
          attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
          url={urlMap} />

        {
          this.state.mapSelected && this.state.mapSelected === "Normal" ? (
            <Fragment>
              <LayerGroup key={5}>
                { this.momentumMarkers()  }
              </LayerGroup>
      
              <LayerGroup key={4} className="deceasedLayer">
                { this.projectedMarkers() }
              </LayerGroup>
      
              <LayerGroup key={3} className="deceasedLayer">
                { this.confirmedMarkers() }
              </LayerGroup>
      
              <LayerGroup key={2} className="recoveredLayer">
                { (this.state.recoveryMode) && this.recoveredMarkers() }
              </LayerGroup>
      
              <LayerGroup key={1} className="deceasedLayer">
                { this.deceasedMarkers() }
              </LayerGroup>
            </Fragment>
          ) : null
        }
        {
          this.state.mapSelected && this.state.mapSelected === "Cases confirmed" ? (
            <Fragment>
              <LayerGroup key={3} className="deceasedLayer">
                { this.confirmedMarkers() }
              </LayerGroup>
              <LayerGroup key={4} className="deceasedLayer">
                { this.projectedMarkers() }
              </LayerGroup>
            </Fragment>
          ) : null
        }
        {
          this.state.mapSelected && this.state.mapSelected === "Countries with more deaths" ? (
            <Fragment>
              <LayerGroup key={1} className="deceasedLayer">
                { this.deceasedMarkers() }
              </LayerGroup>
              <LayerGroup key={4} className="deceasedLayer">
                { this.projectedMarkers() }
              </LayerGroup>
            </Fragment>
          ) : null
        }
      </Map>
    );
  };

  momentumMarkers = () => {
    return (
      this.state.momentum !== "none" &&
      this.confirmed.map(({rowId, name, coordinates, markerOffset, momentumLast1, momentumLast3, momentumLast7, valMin1, valMin3, valMin7}) => {
        let pop = Population.ABSOLUTE[name];
        let size;
        let val;
        switch (this.state.momentum) {
          case "last1":
            if((this.state.recoveryMode ) && this.recovered[rowId]) {
              size = momentumLast1 - this.recovered[rowId].momentumLast1;
              val = valMin1 - this.recovered[rowId].valMin1;
            } else {
              size = momentumLast1;
              val = valMin1;
            }
            break;
          case "last3":
            if((this.state.recoveryMode) && this.recovered[rowId]) {
              size = momentumLast3 - this.recovered[rowId].momentumLast3;
              val = valMin3 - this.recovered[rowId].valMin3;
            } else {
              size = momentumLast3;
              val = valMin3;
            }
            break;
          case "last7":
            if((this.state.recoveryMode) && this.recovered[rowId]) {
              size = momentumLast7 - this.recovered[rowId].momentumLast7;
              val = valMin7 - this.recovered[rowId].valMin7;
            } else {
              size = momentumLast7;
              val = valMin7;
            }
            break;
          default:
            alert("something went wrong");
            break;
        }
        let pos = size >= 0;
        size = Math.abs(size);
        size = this.scaleLog(size);
        size = this.scalePpm(size, pop);
        size = this.scaleLogAndPpm(size);
        if (size > 0 && name !== "US, US") {
          return (
              <CircleMarker
                  key={"change_" + rowId}
                  style={this.state.chart === "pie" ? {display: "block"} : {display: "none"}}
                  center={[coordinates[1], coordinates[0]]}
                  fillColor={pos ? "#FF0000" : "#00FF00"}
                  radius={isNaN(size) ? 0 : Math.sqrt(size) * this.state.factor}
                  opacity={0}
                  fillOpacity={0.5}
              />
          );
        }
        return "";
      })
    )
  };


  projectedMarkers = () => {
    return (
      this.state.momentum==="none" && this.state.testmode &&
        this.projected.map(({ rowId, name, coordinates, markerOffset, size, val }) => {
          let color = "#00f";
          let pop = Population.ABSOLUTE[name];
          let active = val - this.recoveredAbsByRowId[rowId] - this.deathsAbsByRowId[rowId];
          size = this.scale(size, pop);
          size = size * this.state.testscale;
          let ppms = pop && !isNaN(val) ? '(' + Math.round(ONE_M * val / pop) + ' ppm)'  : '';
          let ppms2 = pop && !isNaN(active) ? '(' + Math.round(ONE_M * active / pop) + ' ppm)'  : '';
          let text = `${name} - could be >${rounded(val)} confirmed ${ppms}, >${rounded(active)} active ${ppms2} if local test rate was like global average test rate`;
          return this.marker(coordinates, rowId, color, text, size, val, name, markerOffset, "projected", 0.5);
        })
    )
  };

  confirmedMarkers = () => {

    let entered = false;
    return (
      this.state.momentum==="none" &&
        this.confirmed.map(({ rowId, name, coordinates, markerOffset, size, val }) => {
          if (this.state.playmode && name === "Mexico" && val === 1 && entered === false) {
            entered = true;
            if(window.innerWidth <= 426) {
              this.state.lat = 10;
              this.state.lng = -90;
              this.state.zoom = 1.5;
            } else {
              this.state.lat = 10;
              this.state.lng = -90;
              this.state.zoom = 3;
            }
          }
          let color = "#000";
          let pop = Population.ABSOLUTE[name];
          let active = val - this.recoveredAbsByRowId[rowId] - this.deathsAbsByRowId[rowId];
          size = this.scale(size, pop);
          let ppms = pop && !isNaN(val) ? '(' + Math.round(ONE_M * val / pop) + ' ppm)'  : '';
          let ppms2 = pop && !isNaN(active) ? '(' + Math.round(ONE_M * active / pop) + ' ppm)'  : '';
          let text = `${name} - ${rounded(val)} confirmed ${ppms}, ${rounded(active)} active ${ppms2}`;
          return this.marker(coordinates, rowId, color, text, size, val, name, markerOffset, "confirmed", 0.5);
        })
    )
  };

  recoveredMarkers = () => {
    return (
      this.state.momentum==="none" &&
        this.recovered.map(({rowId, name, coordinates, markerOffset, size, val }) => {
          let color = "#0F0";
          let pop = Population.ABSOLUTE[name];
          if (this.state.chart === "pie" || this.state.chart === "pill") {
            size += this.deathsByRowId[rowId];
          }
          size = this.scale(size, pop);
          let ppms = pop && !isNaN(val) ? '(' + Math.round(ONE_M * val / pop) + ' ppm)' : '';
          let text = name + " - " + rounded(val) + " recovered " + ppms;
          return this.marker(coordinates, rowId, color, text, size, val, name, markerOffset, "recovered", 0.5);
        })
    )
  };

  deceasedMarkers = () => {
    return(
        this.state.momentum==="none" &&
          this.deaths.map(({rowId, name, coordinates, markerOffset, size, val }) => {
            let color = "#dc3545";
            let pop = Population.ABSOLUTE[name];
            size = this.scale(size, pop);
            let ppms = pop && !isNaN(val) ? '(' + Math.round(ONE_M * val / pop) + ' ppm)'  : '';
            let text = name + " - " + rounded(val) + " deceased " + ppms;
            return this.marker(coordinates, rowId, color, text, size, val, name, markerOffset, "deceased", 0.8);
        })
    )
  };

  marker = (coordinates, rowId, color, text, size, val, name, markerOffset, type, opacity) => {
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
          {/*<Tooltip
            direction="bottom"
            offset={[0, 20]}
            opacity={1}
            interactive={true}>
            {this.tooltip(name, rowId)}
          </Tooltip>*/}
          <Popup>
            {this.tooltip(name, rowId)}
          </Popup>
        </CircleMarker>
      );
    }
    return "";
  };


  tooltip = (name, rowId) => {
    try {
      let confirmed = this.confirmed[rowId].val;
      let projected = this.projected[rowId].val;
      let recovered = this.recovered[rowId].val;
      let deaths = this.deaths[rowId].val;
      let active = this.confirmed[rowId].val - this.recoveredAbsByRowId[rowId] - this.deathsAbsByRowId[rowId];

      let g1 = 0.5 * this.confirmed[rowId].momentumLast1 / this.confirmed[rowId].size; // difference between current and last 1
      let g3 = 0.3 * this.confirmed[rowId].momentumLast3 / this.confirmed[rowId].size; // difference between current and last 3
      let g7 = 0.2 * this.confirmed[rowId].momentumLast7 / this.confirmed[rowId].size; // difference between current and last 7
      let g = (g1 + g3 + g7);
      if(g >= 1) {
        g = 0;
      } else if(g >= 0.5) {
        g = 1;
      } else if(g >= 0.2) {
        g = 2;
      } else if(g >= 0.1) {
        g = 3;
      } else if(g >= 0.05) {
        g = 4;
      } else if(g >= 0.02) {
        g = 5;
      } else if(g >= 0.01) {
        g = 6;
      } else if(g >= 0.005) {
        g = 7;
      } else if(g >= 0.002) {
        g = 8;
      } else if(g >= 0.001) {
        g = 9;
      } else if(g >= 0.0) {
        g = 10;
      } else {
        g = "N/A";
      }

      let d1 = 0.7 * this.deaths[rowId].momentumLast1; // death factor
      let d3 = 0.2 * this.deaths[rowId].momentumLast3; // death factor
      let d7 = 0.1 * this.deaths[rowId].momentumLast7; // death factor
      let d = (d1 ? d1 : 0 + d3 ? d3 : 0 + d7 ? d7 : 0);
      if(d <= 0) {
        d = 10;
      } else if(d <= 0.001) {
        d = 9;
      } else if(d <= 0.002) {
        d = 8;
      } else if(d <= 0.005) {
        d = 7;
      } else if(d <= 0.01) {
        d = 6;
      } else if(d <= 0.02) {
        d = 5;
      } else if(d <= 0.022) {
        d = 4;
      } else if(d <= 0.24) {
        d = 3;
      } else if(d <= 0.26) {
        d = 2;
      } else if(d <= 0.28) {
        d = 1;
      } else {
        d = 0;
      }

      let stayAtHomeScore = Math.round(g);
      if(confirmed < 1 || !stayAtHomeScore) {
        stayAtHomeScore = "N/A";
      }

      let lifeSaverScore = Math.round(d);
      if(deaths < 1 && confirmed > 0) {
        lifeSaverScore = "10";
      }
      else if(deaths < 1) {
        lifeSaverScore = "N/A";
      }
      return (
        <div>
          <div>
            <b className="d-block">{name}</b>
            <FontAwesomeIcon icon={faUsers}/> {rounded(Population.ABSOLUTE[name])} &middot;
            <FontAwesomeIcon icon={faBiohazard}/> {rounded(confirmed)} &middot;
            <FontAwesomeIcon icon={faBolt}/> {rounded(ONE_M * confirmed/Population.ABSOLUTE[name])} ppm
            {
              (!this.state.recoveryMode) &&
                [
                  " · ",
                  <Badge variant="danger">
                    &nbsp; <FontAwesomeIcon icon={faSkull}/> {rounded(deaths)} deaths &nbsp;
                  </Badge>
                ]
            }
          </div>
          <div>
            {
              (this.state.recoveryMode) &&
              [
                <Badge variant={"danger"}><FontAwesomeIcon icon={faProcedures}/> {rounded(active)} active</Badge>,
                <Badge className="ml-1 mr-1" variant={"success"}><FontAwesomeIcon icon={faHeartbeat}/> {rounded(recovered)} recovered</Badge>
              ]
            }
            {
              (this.state.recoveryMode) &&
              [
                <Badge variant={"dark"}><FontAwesomeIcon icon={faHeartBroken}/> {rounded(deaths)} deceased</Badge>,
                <br />
              ]
            }
            {
              projected > confirmed && this.state.testmode && this.state.testscale > 0 &&
              <Badge variant={"primary"}><FontAwesomeIcon icon={faBiohazard}/> &gt;{rounded(projected)} projected at global avg. testing rate</Badge>
            }
          </div>
          <div className="stayAtHomeScoreLabel">
            <span className="stayAtHomeAdvice text-center d-block">{this.stayAtHomeAdvice(active)}</span>
          </div>
        </div>
      )
    } catch(e) {
      return "Could not load tooltip data.";
    }
  };

  stayAtHomeAdvice = (active) => {
    if(active > 150) {
      return "You save lives by staying at home today!"
    }
    if (active > 0) {
      return "Avoid crowds! Keep social distance!";
    }
    return "No active cases detected in this region.";
  };

  scale = (value, population) => {
    value = this.scaleIfPillOrBar(value);
    value = this.scaleLog(value);
    value = this.scalePpm(value, population);
    value = this.scaleLogAndPpm(value);
    return value;
  };

  scaleIfPillOrBar = (value) => {
    if(this.state.chart==="pill" || this.state.chart==="bar") {
      return value * 10;
    }
    return value;
  };

  scaleLog = (value) => {
    if(!this.state.logmode) {
      return value;
    }
    if(value > 0) {
      return Math.log(value * 10000) / 100;
    }
    return 0;
  };

  scalePpm = (value, population) => {
    if(!this.state.ppmmode) {
      return value;
    }
    if(population) {
      if((value > 0)&&(population>ONE_M)) {
        return ONE_M * value / population * 10;
      }
    }
    return 0;
  };

  scaleLogAndPpm = (value) => {
    if(this.state.logmode && this.state.ppmmode) {
      return value / 10;
    }
    return value;
  };


}

export default memo(MapChart);
