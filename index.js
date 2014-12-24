var request = require("request");
var cheerio = require("cheerio");
var debug = require("debug");
var util = require("util");
var XLS = require("xlsjs");

var rootPath = "https://myaccount.zaad.net";
var defaultPath = "/default.aspx";
var welcomePath = "/welcome.aspx";
var logoutPath = "/logout_transit.aspx";
var tokenPath = "/CheckAccessKey.aspx";
var sendMoneyPath = "/Admin/CustomerSingleTransactions.aspx?TranType=5";
var reportsPath = "/Admin/Reports.aspx";
var accountActivityPath = "/Admin/ShowReport.aspx";

var zapi = {
  getCaptcha: function(state, cb){
    var log = debug("zapi:getCaptcha");

    var jar = request.jar();

    if(state.cookie) {
      var cookie = request.cookie(state.cookie);

      jar.setCookie(cookie, rootPath);
    }

    log("getting " + rootPath + defaultPath);

    request({
      url: rootPath + defaultPath,
      jar: jar
    }, function(err){
      state.cookie = jar.getCookieString(rootPath);

      if(err) {
        return cb(err, state);
      }

      log("getting " + rootPath + welcomePath);

      request.get({
        url: rootPath + welcomePath,
        jar: jar
      }, function(err2, response, body){
        state.cookie = jar.getCookieString(rootPath);

        if(err2) {
          return cb(err2, state);
        }

        var $ = cheerio.load(body);

        var captchaUrl = $("#ImageVerifier1").attr("src");

        state.viewStateAtCaptchaPage = $("#__VIEWSTATE").val();
        state.eventValidationAtCaptchaPage = $("#__EVENTVALIDATION").val();

        log("getting " + rootPath + '/' + captchaUrl);

        request.get({
          url: rootPath + "/" + captchaUrl,
          jar: jar,
          encoding: null
        },
        function(err3, response2, captchaBuffer){
          state.cookie = jar.getCookieString(rootPath);

          cb(err3, state, captchaBuffer);
        });
      });
    });
  },
  login: function(credentials, state, cb){
    var log = debug("zapi:getCaptcha");

    var jar = request.jar();

    if(state.cookie) {
      var cookie = request.cookie(state.cookie);

      jar.setCookie(cookie, rootPath);
    }

    var form = {
      "__EVENTTARGET": "",
      "__EVENTARGUMENT": "",
      "__VIEWSTATE": state.viewStateAtCaptchaPage,
      "__EVENTVALIDATION": state.eventValidationAtCaptchaPage,
      "txtuid": credentials.phone,
      "txtpwd": credentials.password,
      "txtVerifyText": credentials.captcha,
      "btnLogin": "Login"
    };

    log("posting " + rootPath + welcomePath);

    request.post({
      url: rootPath + welcomePath,
      jar: jar,
      form: form
    }, function(err, httpResponse, body){
      state.cookie = jar.getCookieString(rootPath);

      var loginSucceeded = httpResponse.headers["location"] === "/CheckAccessKey.aspx";

      cb(err, state, loginSucceeded);
    });
  },
  submitToken: function(token, state, cb){
    var log = debug("zapi:submitToken");

    var jar = request.jar();

    if(state.cookie){
      var cookie = request.cookie(state.cookie);

      jar.setCookie(cookie, rootPath);
    }

    log("getting " + rootPath + tokenPath);

    request.get({
      url: rootPath + tokenPath,
      jar: jar
    }, function(err, response, body){
      state.cookie = jar.getCookieString(rootPath);

      if(err) {
        log("err", err);

        return cb(err, state);
      }

      var $ = cheerio.load(body);

      var viewState = $("#__VIEWSTATE").val();
      var eventValidation = $("#__EVENTVALIDATION").val();

      var form = {
        "__LASTFOCUS": "",
        "__VIEWSTATE": viewState,
        "__EVENTTARGET": "",
        "__EVENTVALIDATION": eventValidation,
        "txtaccesskey": token,
        "btnSubmit": "Submit"
      };

      log("posting " + rootPath + tokenPath);

      request.post({
        url: rootPath + tokenPath,
        jar: jar,
        form: form
      }, function(err2, response2, body2){
        state.cookie = jar.getCookieString(rootPath);

        var wasTokenValid = body2.indexOf("<script>parent.location='Admin/';</script>") === 0;

        cb(err, state, wasTokenValid);
      });
    });
  },
  logout: function (state, cb) {
    var log = debug("zapi:logout");

    var jar = request.jar();

    if(state.cookie){
      var cookie = request.cookie(state.cookie);

      jar.setCookie(cookie, rootPath);
    }

    log("getting " + rootPath + logoutPath);

    request.get({
      url: rootPath + logoutPath,
      jar: jar
    }, function(err, response, body) {
      state.cookie = jar.getCookieString(rootPath);

      if (err) {
        log("err", err);
      }

      return cb(err, state);
    });
  },
  getBalance: function(state, cb){
    var log = debug("zapi:getBalance");

    var jar = request.jar();

    if(state.cookie){
      var cookie = request.cookie(state.cookie);

      jar.setCookie(cookie, rootPath);
    }

    log("getting " + rootPath + sendMoneyPath);

    request.get({
      url: rootPath + sendMoneyPath,
      jar: jar
    }, function(err, response, body) {
      state.cookie = jar.getCookieString(rootPath);

      if (err) {
        return cb(err, state);
      }

      if (sessionTimedOut(response)) {
        return cb("Session timed out", state);
      }

      log("parsing balance");

      var $ = cheerio.load(body);

      var balanceText = $("#lblCurrentBalance").text().trim();

      var balance = balanceText.substring(balanceText.indexOf(":") + 3);
      balance = Number(balance);

      cb(null, state, balance);
    });
  },
  getRecentTransactions: function(state, cb){
    var log = debug("zapi:getRecentTransactions");

    log("This function is deprecated. Use getTransactions instead.")

    var oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 6);

    var today = new Date();

    var fromToRange = {
      from: oneWeekAgo,
      to: today
    };

    if(state.accountId) {
      fetchTransactions(fromToRange, state.accountId, state, cb);
    }
    else{
      fetchAccountId(state, function(err, newState, accountId){
        log("fetched accountId", accountId);

        if(err){
          cb(err, newState);
        }
        else{
          newState.accountId = accountId;

          fetchTransactions(fromToRange, accountId, newState, cb);
        }
      });
    }
  },
  getTransactions: function(fromToRange, state, cb){
    var log = debug("zapi:getTransactions");

    if(state.accountId) {
      fetchTransactions(fromToRange, state.accountId, state, cb);
    }
    else{
      fetchAccountId(state, function(err, newState, accountId){
        log("fetched accountId", accountId);

        if(err){
          cb(err, newState);
        }
        else{
          newState.accountId = accountId;

          fetchTransactions(fromToRange, accountId, newState, cb);
        }
      });
    }
  },
  sendMoney: function(transaction, state, cb){
    var log = debug("zapi:sendMoney");

    var jar = request.jar();

    if(state.cookie){
      var cookie = request.cookie(state.cookie);

      jar.setCookie(cookie, rootPath);
    }

    log("getting", rootPath + sendMoneyPath);

    request.get({
      url: rootPath + sendMoneyPath,
      jar: jar
    }, function(err, response, body){
      state.cookie = jar.getCookieString(rootPath);

      if(err){
        return cb(err, state);
      }

      if (sessionTimedOut(response)) {
        return cb("Session timed out", state);
      }

      var $ = cheerio.load(body);

      var viewState = $("#__VIEWSTATE").val();
      var eventValidation = $("#__EVENTVALIDATION").val();

      var form = {
        "__LASTFOCUS": "",
        "__EVENTTARGET": "",
        "__EVENTARGUMENT": "",
        "__VIEWSTATE": viewState,
        "__EVENTVALIDATION": eventValidation,
        ddlTranType: 5,
        txtaccountid: transaction.phone,
        txtamount: transaction.amount,
        ddlNet: 0,
        txtdescription: transaction.description,
        btnSubmit: "Submit"
      };

      log("posting", rootPath + sendMoneyPath);

      request.post({
        url: rootPath + sendMoneyPath,
        jar: jar,
        form: form
      }, function(err2, response2, body2){
        state.cookie = jar.getCookieString(rootPath);

        if(err2){
          return cb(err, state);
        }

        if (sessionTimedOut(response)) {
          return cb("Session timed out", state);
        }

        if(response2.headers["location"] && response2.headers["location"].indexOf("/Admin/CustomerSingleTranConfirm.aspx") === 0){
          state.confirmUrl = response2.headers["location"];

          cb(null, state, true);
        }
        else{
          cb(null, state, false);
        }
      });
    });
  },
  sendMoneyConfirm: function(code, state, cb){
    var log = debug("zapi:sendMoneyConfirm");

    var jar = request.jar();

    if(state.cookie){
      var cookie = request.cookie(state.cookie);

      jar.setCookie(cookie, rootPath);
    }

    var location = state.confirmUrl;

    log("getting " + rootPath + location);

    request.get({
      url: rootPath + location,
      jar: jar
    }, function(err, response, body){
      state.cookie = jar.getCookieString(rootPath);

      if(err){
        return cb(err, state);
      }

      if (sessionTimedOut(response)) {
        return cb("Session timed out", state);
      }

      var $ = cheerio.load(body);
      var viewState = $("#__VIEWSTATE").val();
      var eventValidation = $("#__EVENTVALIDATION").val();

      var form = {
        "__VIEWSTATE": viewState,
        "__EVENTVALIDATION": eventValidation,
        "txtTransactionKey": code,
        "btnSubmit": "Confirm & Approve"
      };

      log("posting " + rootPath + location);

      request.post({
        url: rootPath + location,
        jar: jar,
        form: form,
        followRedirect: false
      }, function(err2, response2, body2){
        state.cookie = jar.getCookieString(rootPath);

        if(err2){
          return cb(err2, state);
        }

        if (sessionTimedOut(response2)) {
          return cb("Session timed out", state);
        }

        var wasTransactionConfirmed = response2.headers["location"] && response2.headers["location"].indexOf("/Admin/ShowReport.aspx") === 0;

        cb(null, state, wasTransactionConfirmed);
      });
    });
  }
};

function sessionTimedOut(response){
  return response.headers["location"] === "/Support/m_sessionexpredirect.aspx" ||
    response.request.path === "/Support/m_sessionexpired.aspx";
}

function padWithZeroes(number, expectedNumberOfDigits){
  var result = "";

  for(var i = 0; i < expectedNumberOfDigits; i++){
    result += "0";
  }

  result += number;

  return result.slice(result.length - expectedNumberOfDigits);
}

function fetchAccountId(state, cb){
  var log = debug("zapi:fetchAccountId");

  var jar = request.jar();

  if(state.cookie){
    var cookie = request.cookie(state.cookie);

    jar.setCookie(cookie, rootPath);
  }

  var qs = {
    "PRINTRPT": "WEB_CUSTOMER_ACOUNTACTIVITY"
  };

  log("getting " + rootPath + reportsPath, qs);

  request.get({
    url: rootPath + reportsPath,
    jar: jar,
    qs: qs
  }, function(err, response, body){
    state.cookie = jar.getCookieString(rootPath);

    if (err) {

      return cb(err, state);
    }

    if (sessionTimedOut(response)) {
      return cb("Session timed out", state);
    }

    log("parsing accountId");

    var $ = cheerio.load(body);

    var accountId = $("#rptShowParameters_ctl01_txtParameterValue").val();

    cb(null, state, accountId);
  });
}

function fetchTransactions(fromToRange, accountId, state, cb) {
  var log = debug("zapi:fetchTransactions");

  var jar = request.jar();

  if(state.cookie){
    var cookie = request.cookie(state.cookie);

    jar.setCookie(cookie, rootPath);
  }

  var to = fromToRange.to;
  var endDate = util.format("%s%s%s", to.getFullYear(), padWithZeroes(to.getMonth() + 1, 2), padWithZeroes(to.getDate(), 2));

  var from = fromToRange.from;
  var begDate = util.format("%s%s%s", from.getFullYear(), padWithZeroes(from.getMonth() + 1, 2), padWithZeroes(from.getDate(), 2));

  var params = util.format("AccountID=%s!BegDate=%s!EndDate=%s", accountId, begDate, endDate);

  var qs = {
    "PRINTRPT": "WEB_CUSTOMER_ACOUNTACTIVITY",
    "Params": params
  };

  log("getting", rootPath + accountActivityPath, qs);

  request.get({
    url: rootPath + accountActivityPath,
    jar: jar,
    qs: qs,
    headers: {
      "User-Agent": "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:34.0) Gecko/20100101 Firefox/34.0"
    }
  }, function (err, response, body) {
    state.cookie = jar.getCookieString(rootPath);

    if (err) {

      return cb(err, state);
    }

    if (sessionTimedOut(response)) {
      return cb("Session timed out", state);
    }

    if (response.statusCode === 500) {
      log("response.statusCode was 500");

      return cb(null, state, []);
    }

    if(response.body.substring(88, 101) === "No Data found"){
      log("No Data Found.");

      return cb(null, state, []);
    }

    var $ = cheerio.load(body);

    var viewState = $("#__VIEWSTATE").val();
    var eventValidation = $("#__EVENTVALIDATION").val();

    var form = {
      "__EVENTTARGET": "CrystalReportViewer1",
      "__EVENTARGUMENT": "export",
      "__LASTFOCUS": "",
      "__VIEWSTATE": viewState,
      "__EVENTVALIDATION": eventValidation,
      "exportformat": "RecordToMSExcel",
      "isRange": "all"
    };

    log("posting", rootPath + accountActivityPath, qs);

    request.post({
      url: rootPath + accountActivityPath,
      jar: jar,
      qs: qs,
      form: form,
      encoding: null
    }, function (err2, response2, body2) {
      state.cookie = jar.getCookieString(rootPath);

      if (err2) {
        return cb(err2, state);
      }

      if (sessionTimedOut(response2)) {
        return cb("Session timed out", state);
      }

      log("parsing excel sheet");

      var workbook = XLS.read(body2, {type: "buffer"});

      var rows = [];
      var r = 2;
      var nextRowFirstColumn = workbook.Sheets["Sheet1"][XLS.utils.encode_cell({c: 0, r: r})].v;

      while (nextRowFirstColumn !== "totals:") {
        if (!workbook.Sheets["Sheet1"][XLS.utils.encode_cell({c: 0, r: r})].v) {
          throw  new Error("Shouldn't see an empty cell");
        }

        var row = {
          id: workbook.Sheets["Sheet1"][XLS.utils.encode_cell({c: 0, r: r})].v,
          date: workbook.Sheets["Sheet1"][XLS.utils.encode_cell({c: 1, r: r})].w,
          desc: workbook.Sheets["Sheet1"][XLS.utils.encode_cell({c: 2, r: r})].v,
          type: workbook.Sheets["Sheet1"][XLS.utils.encode_cell({c: 3, r: r})].v,
          ref: workbook.Sheets["Sheet1"][XLS.utils.encode_cell({c: 4, r: r})].v,
          debit: workbook.Sheets["Sheet1"][XLS.utils.encode_cell({c: 5, r: r})].v,
          credit: workbook.Sheets["Sheet1"][XLS.utils.encode_cell({c: 6, r: r})].v,
          balance: workbook.Sheets["Sheet1"][XLS.utils.encode_cell({c: 7, r: r})].v
        };

        rows.push(row);

        r++;
        nextRowFirstColumn = workbook.Sheets["Sheet1"][XLS.utils.encode_cell({c: 0, r: r})].v;
      }

      cb(null, state, rows);
    });
  });
}

module.exports = zapi;
