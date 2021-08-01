const axios = require("axios").default;
const xml2js = require("xml2js");

const transformResponse = [
  (data) => {
    let jsonData;
    const parser = new xml2js.Parser({
      async: false,
      explicitArray: false,
    });
    parser.parseString(data, (error, json) => {
      jsonData = json;
    });
    return jsonData;
  },
];

const APP_ID = "dj0zaiZpPXlWN2pta2hFZnNGOSZzPWNvbnN1bWVyc2VjcmV0Jng9MDI-";

const localSearch = async (query) => {
  const { data } = await axios.get(
    "https://map.yahooapis.jp/search/local/V1/localSearch",
    {
      transformResponse,
      params: {
        query: query,
        appid: APP_ID,
        lat: "35.0240658",
        lon: "135.727751",
        dist: "10",
        detail: "full",
        sort: "dist",
        results: 5,
      },
    }
  );

  return data.YDF.Feature.map((f) => {
    const url = f.Property.Detail.MobileUrl1
      ? f.Property.Detail.MobileUrl1
      : f.Property.Detail.PcUrl1
      ? f.Property.Detail.PcUrl1
      : `https://search.yahoo.co.jp/search?p=${query}+${f.Name}`;

    return {
      name: f.Name,
      address: f.Property.Address,
      image: f.Property.LeadImage
        ? f.Property.LeadImage
        : "https://placehold.jp/18/cccccc/ffffff/160x160.png?text=No%20Image",
      url,
    };
  });
};

// yolpSearch("居酒屋").then(console.log);

module.exports = {
  localSearch,
};
