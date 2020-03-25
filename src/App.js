import React, { useState } from 'react';
import MapChart from "./MapChart";
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Navbar from 'react-bootstrap/Navbar';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {  faGlobe,
          faSkull,
          faBiohazard } from '@fortawesome/free-solid-svg-icons';

const rounded = (num) => {
    if (num > 1000000000) {
        return Math.round(num / 100000000) / 10 + "Bn";
    } else if (num > 1000000) {
        return Math.round(num / 100000) / 10 + "M";
    } else {
        return Math.round(num / 100) / 10 + "K";
    }
};

function App() {
  const [totConf, setTotConf] = useState(0);
  const [totRec, setTotRec] = useState(0);
  const [totDead, setTotDead] = useState(0);

  return (
    [
      <Navbar bg="dark" fixed="top" className={"p-0 pl-2"} expand={"xs"}>
        <Container fluid="md" className="mt-0">
          <Row className="w-100">
            <Col xs={12} sm={6} md={6}>
              <Navbar.Brand>
                <span className="text-white">COVID-19 Map Interactive</span>
              </Navbar.Brand>
            </Col>
            <Col xs={12} sm={6} md={6}>
              <span className="global-stats">
                <span className="small font-weight-bold mr-3">
                  <FontAwesomeIcon icon={faBiohazard} className="text-white mr-2" />
                  <span style={{ color: "#747475"}}>
                    {rounded(totConf)}
                  </span>
                </span>
                {
                  totRec > 0 &&
                  <span className="small font-weight-bold text-success mr-3">
                    {rounded(totRec)}
                  </span>
                }
                <span className="small font-weight-bold mr-3">
                  <FontAwesomeIcon icon={faSkull} className="text-white mr-2" />
                  <span className="text-danger">{rounded(totDead)}</span>
                </span>
                <span className="small text-white ml-3">
                  <FontAwesomeIcon icon={faGlobe} />
                </span>
              </span>
            </Col>
          </Row>
        </Container>
      </Navbar>,
      <Container fluid className="w-100 h-100 p-0">
        <Row noGutters="true" className="h-100">
          <Col className="h-100">
            <MapChart
              key={"mapChart"}
              style={{marginTop: "50px"}}
              setTotConf={setTotConf}
              setTotRec={setTotRec}
              setTotDead={setTotDead}
            />
          </Col>
        </Row>
      </Container>
    ]
  );
}

export default App;
