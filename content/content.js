window.addEventListener("load", () => Util.windowLoaded(contentIsReady), false);

function contentIsReady() {
  // We want the extension to run only on jira. subdomains.
  // For example: jira.company.com
  const DOMAIN_MATCH_PREFIX = "jira";
  var domain = /:\/\/([^\/]+)/.exec(window.location.href)[1].toLowerCase();

  // if (!domain.startsWith("jira.")) {
  //   // Disable the extension for subdomains different from .jira
  //   return;
  // }

  Util.log(`content is ready, jquery v${$.fn.jquery} was loaded`);
  Styles.init();

  let settings;
  let dom = {
    extension: {
      containerId: CONSTANTS.EXTENSION_ELEMENT_ID,
      enablerContainerId: `${CONSTANTS.EXTENSION_ELEMENT_ID}-enabler`,
      imgContainerId: `${CONSTANTS.EXTENSION_ELEMENT_ID}-image`,
    },
  };
  $.extend(dom, SOFTWARES);

  chrome.storage.onChanged.addListener(function (changes, areaName) {
    Util.log("chrome.storage.onChanged", changes.todaily);

    settings =
      (changes &&
        changes.todaily &&
        changes.todaily.newValue &&
        Object.keys(changes.todaily.newValue).length > 0 &&
        changes.todaily.newValue) ||
      SETTINGS.defaults;

    updateEnabler();
    tryStartCountdown();
  });

  const CountDown = {
    clearance: function (delay) {
      delay = delay || 0;

      const _clearance = function () {
        const elem = $(`#${dom.extension.containerId}`);
        if (elem && elem.length !== 0) {
          elem.remove();
          Util.log("dom.extension.containerId removed");
        } else {
          Util.log("dom.extension.containerId doesnt exist");
        }
        const imgElem = $(`#${dom.extension.imgContainerId}`);
        if (imgElem && imgElem.length !== 0) {
          imgElem.remove();
          Util.log("dom.extension.imgContainerId removed");
        } else {
          Util.log("dom.extension.imgContainerId doesnt exist");
        }
        clearInterval(CountDown.interval);
      };
      if (delay) {
        setTimeout(() => {
          _clearance();
        }, delay);
      } else {
        _clearance();
      }
    },
    interval: null,
    start: function (text) {
      CountDown.clearance();

      const countDownElem = $("<div>", {
        id: dom.extension.containerId,
        style: `-webkit-animation: fadein 1s; ${
          dom[settings.software].containerStyle
        }`,
      });

      $("body").append(countDownElem);

      let timeLeft = settings.countdownSeconds;

      const intervalHandler = () => {
        let countdownState;

        if (timeLeft <= 0) {
          CountDown.timeout();
          return;
        } else if (timeLeft <= settings.countdownSeconds * 0.3) {
          countdownState = settings.danger;
        } else if (timeLeft <= settings.countdownSeconds * 0.5) {
          countdownState = settings.warn;
        } else {
          countdownState = settings.safe;
        }

        countDownElem.css("background-color", countdownState.color);
        countDownElem.css("color","#000000")
        countDownElem.css("font-size","20px")
        countDownElem.html(
          `${text} ${countdownState.text}, you have ${timeLeft} seconds left..`
        );

        timeLeft -= 1;
      };

      CountDown.interval = setInterval(() => {
        intervalHandler();
      }, 1000);
      intervalHandler();
    },
    timeout: function () {
      clearInterval(CountDown.interval);
      var alertAudio = new Audio();
      alertAudio.src = chrome.extension.getURL("resources/alert.mp3");
      alertAudio.play();

      const elem = $(`#${dom.extension.containerId}`);
      elem.html(settings.timeout.text);

      if (settings.timeout.imageUrl) {
        elem.after(
          $("<img>", {
            class: "timeout-img",
            id: dom.extension.imgContainerId,
            src: settings.timeout.imageUrl,
            style: `position:fixed;   z-index:99;  height: 200px;  top:50%;  left:50%;  margin-top: -100px;`,
          })
        );
      }
      CountDown.clearance(5000);
    },
  };

  function tryStartCountdown() {
    const currState = getActivationState();
    if (currState.enable) {
      setTimeout(() => {
        CountDown.start(currState.text);
      }, 500);
    } else {
      CountDown.clearance();
      Util.log("currState should not start countdown");
    }
  }

  function getActivationState() {
    const elemActive = $(
      `${dom[settings.software].buttonsSelector}.${
        dom[settings.software].buttonActiveClass
      }`
    );

    return {
      enable: elemActive.length === 1 && settings.enable,
      text: $(elemActive[0]).text(),
    };
  }

  function updateEnabler() {
    const cls = settings.enable ? "on" : "off";
    let enabler = $(`#${dom.extension.enablerContainerId}`);

    if (!enabler || enabler.length == 0) {
      enabler = $("<button>", {
        id: dom.extension.enablerContainerId,
      });
      $("body").append(enabler);
    }
    enabler.attr("class", `enabler enabler-${cls}`);
    enabler.attr(
      "style",
      `bottom: 46px;
      padding: 0;
      left: 5px;
      width: 45px;
      height: 45px;
      position: fixed;
      border: solid 1px #bbb;
      z-index: 99;
      border-radius: 5px;
      outline: none;
      font-weight:bold;
      cursor:pointer;
      ${cls === "on" ? "background:#dac32a;" : "background:#c8c8c8;"}
      `
    );
    enabler.html(
      `<span style="font-size:8px;">STANDUP</span><br/><span style="font-size:10px;"> ${cls.toUpperCase()}</span>`
    );
    return enabler;
  }

  function addEnabler() {
    const enabler = updateEnabler();

    enabler.click(() => {
      const time = +new Date();

      chrome.storage.sync.set(
        {
          todaily: {
            ...settings,
            enable: !settings.enable,
            time,
          },
        },
        function () {
          updateEnabler();
          Util.log("done");
          tryStartCountdown();
        }
      );
    });
  }

  chrome.storage.sync.get([CONSTANTS.STORAGE_NAME], (todailySettings) => {
    settings =
      (todailySettings &&
        todailySettings.todaily &&
        Object.keys(todailySettings.todaily).length > 0 &&
        todailySettings.todaily) ||
      SETTINGS.defaults;

    addEnabler();

    $(dom[settings.software].buttonsSelector).click((t) => {
      Util.log("buttonSelector.clicked", t);
      tryStartCountdown();
    });

    Util.log("first try start countdown");
    tryStartCountdown();
  });
}
