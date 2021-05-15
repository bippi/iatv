const express = require("express");
const xml2js = require("xml2js");
const axios = require("axios");
const soapRequest = require("easy-soap-request");
const groupBy = require("lodash/groupBy");
const cheerio = require("cheerio");
const app = express();
app.set("view engine", "pug");

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
  const homeTeamStartUp = [];
  const homeTeamSubs = [];
  const awayTeamStartUp = [];
  const awayTeamSubs = [];
  axios.get(`https://www.ksi.is/mot/leikskyrsla/?leikur=${req.params.nr}`).then((result)=>{
    const $ = cheerio.load(result.data);
    //console.log($.html());
    const startUp = $('.panel-default').first();
    const subs = $('.panel-default:eq(1)');
    const startUprows = startUp.find('.report-table > table > tbody > tr');
    const subsRows = subs.find('.report-table > table > tbody > tr');

    //console.log('------rows-----', rows.length)
    //console.log(startUp);
    startUprows.each((index, tr)=>{
      //console.log(tr);
      const homeRow = $(tr).find('td:first-child');
      const awayRow = $(tr).find('td:last-child');
      const homeName = homeRow.find('table>tbody>tr>td:nth-child(2)>a').text();
      const homeNr = homeRow.find('table>tbody>tr>td:nth-child(1)').text()
      const awayName = awayRow.find('table>tbody>tr>td:nth-child(2)>a').text();
      const awayNr = awayRow.find('table>tbody>tr>td:nth-child(1)').text()
      const homeObj = {
        name: homeName,
        number: homeNr
      }
      const awayObj = {
        name: awayName,
        number: awayNr
      }
      homeTeamStartUp.push(homeObj);
      awayTeamStartUp.push(awayObj);
      
    })

    subsRows.each((index, tr)=>{
      //console.log(tr);
      const homeRow = $(tr).find('td:first-child');
      const awayRow = $(tr).find('td:last-child');
      const homeName = homeRow.find('table>tbody>tr>td:nth-child(2)>a').text();
      const homeNr = homeRow.find('table>tbody>tr>td:nth-child(1)').text()
      const awayName = awayRow.find('table>tbody>tr>td:nth-child(2)>a').text();
      const awayNr = awayRow.find('table>tbody>tr>td:nth-child(1)').text()
      const homeObj = {
        name: homeName,
        number: homeNr
      }
      const awayObj = {
        name: awayName,
        number: awayNr
      }
      homeTeamSubs.push(homeObj);
      awayTeamSubs.push(awayObj);
      
    })
    //console.log(startUp);
  res.send({homeTeamStartUp, homeTeamSubs, awayTeamStartUp, awayTeamSubs})
  });

  // console.log(result);
  // axios
  //   .get(`http://${req.headers.host}/soaptojson/${req.params.nr}`)
  //   .then(resp => {
  //     res.render("index", {
  //       title: "Lið",
  //       gameNumber: req.params.nr,
  //       message: "Listi yfir leikmenn",
  //       hometeam: resp.data.homeTeam,
  //       awayteam: resp.data.awayTeam
  //     });
  //   })
  //   .catch(err => {
  //     console.log(err);
  //   });
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

    console.log(statusCode);

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

const generateHomeTeamString = team => {
  const teamArr = team.map(item => {
    return `${item.TreyjuNumer !== "" ? item.TreyjuNumer+"" : ""}${item.TreyjuNumer === "" ? "("+item.StadaNafn.trim().substr(0,1)+")" : ""} ${
      item.LeikmadurNafn.trim()
    }`;
  });

  return teamArr.join("\n");
};

const generateAwayTeamString = team => {
  const teamArr = team.map(item => {
    return `${
      item.LeikmadurNafn.trim()
    } ${item.TreyjuNumer !== "" ? item.TreyjuNumer.trim() : ""}${item.TreyjuNumer === "" ? "("+item.StadaNafn.trim().substr(0,1)+")" : ""}`;
  });

  return teamArr.join("\n");
};

app.get("/file/:team/:group/:nr", (req, res) => {
  const { params } = req;
  const { team, group, nr } = params;
  let text = "";
  axios
    .get(`http://${req.headers.host}/soaptojson/${nr}`)
    .then(resp => {
      //console.log(resp.data[team][group]);

      if (team === "homeTeam"){
        text = generateHomeTeamString(resp.data[team][group]);
      }

      else {
        text = generateAwayTeamString(resp.data[team][group]);
      }
      

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
});

// app.listen(port, () => {
//   console.log(`Example app listening on port ${port}!`);
// });

module.exports = app;
