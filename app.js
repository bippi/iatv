const express = require("express");
const xml2js = require("xml2js");
const axios = require("axios");
const soapRequest = require("easy-soap-request");
const groupBy = require("lodash/groupBy");
const app = express();
app.set("view engine", "pug");
const port = 3000;

const generateTeamJson = team => {
  return team.reduce(
    (accumulator, item) => {
      const starting = [];

      if (
        item.StadaNumer === "30" ||
        item.StadaNumer === "31" ||
        item.StadaNumer === "32"
      ) {
        //starting.push(item);
        accumulator.starting.push(item);
      } else {
        accumulator.bench.push(item);
      }
      return accumulator;
    },
    { starting: [], bench: [] }
  );
};

app.get("/leikur/:nr", function(req, res) {
  const result = `Base url for appAdmin is ${req.headers.host}, original url is : ${req.originalUrl}`;

  console.log(result);
  axios
    .get(`http://${req.headers.host}/soaptojson/${req.params.nr}`)
    .then(resp => {
      res.render("index", {
        title: "Lið",
        gameNumber: req.params.nr,
        message: "Listi yfir leikmenn",
        hometeam: resp.data.homeTeam,
        awayteam: resp.data.awayTeam
      });
    })
    .catch(err => {
      console.log(err);
    });
});

app.get("/soaptojson/:nr", (req, res) => {
  const parser = new xml2js.Parser({ explicitArray: false });
  const { nr } = req.params;
  const url = "http://www2.ksi.is/vefthjonustur/mot.asmx?WSDL";
  const sampleHeaders = {
    "user-agent": "sampleTest",
    "Content-Type": "text/xml;charset=UTF-8",
    soapAction: "http://www2.ksi.is/vefthjonustur/mot/LeikurLeikmenn"
  };
  const xml = `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <LeikurLeikmenn xmlns="http://www2.ksi.is/vefthjonustur/mot/">
      <LeikurNumer>${nr}</LeikurNumer>
    </LeikurLeikmenn>
  </soap:Body>
</soap:Envelope>
`;
  // usage of module
  (async () => {
    const { response } = await soapRequest({
      url: url,
      xml: xml,
      timeout: 1000,
      headers: sampleHeaders
    }); // Optional timeout parameter(milliseconds)
    const { headers, body, statusCode } = response;
    //console.log(headers);
    //console.log(body);
    //console.log(statusCode);
    //res.set("Content-Type", "text/xml");

    parser.parseStringPromise(body).then(result => {
      const players =
        result["soap:Envelope"]["soap:Body"].LeikurLeikmennResponse
          .LeikurLeikmennSvar.ArrayLeikurLeikmenn.LeikurLeikmenn;
      const grouped = groupBy(players, player => player.FelagNumer);
      const homeLineUp = generateTeamJson(Object.values(grouped)[0]);
      const awayLineUp = generateTeamJson(Object.values(grouped)[1]);
      res.json({ homeTeam: homeLineUp, awayTeam: awayLineUp });
    });
  })();
  //console.log(req);
});

const generateTeamString = team => {
  const teamArr = team.map(item => {
    return `${item.TreyjuNumer !== "" ? item.TreyjuNumer : ""}${
      item.LeikmadurNafn
    } ${item.TreyjuNumer === "" ? item.StadaNafn : ""}`;
  });

  return teamArr.join("\n");
};

app.get("/file/:team/:group/:nr", (req, res) => {
  const { params } = req;
  const { team, group, nr } = params;
  axios
    .get(`http://${req.headers.host}/soaptojson/${nr}`)
    .then(resp => {
      //console.log(resp.data[team][group]);
      const text = generateTeamString(resp.data[team][group]);

      res.setHeader("Content-type", "application/octet-stream");

      res.setHeader(
        `Content-disposition`,
        `attachment; filename=${team}-${group}.txt`
      );

      res.send(text);
    })
    .catch(err => {
      console.log(err);
    });
  // var text = "hello world";

  //res.send("<h1>foo</h1>");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`);
});
