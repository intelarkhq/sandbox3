let authCode = localStorage.getItem('authCode');
let accountId = localStorage.getItem('accountId');
let username

const API_URL = "https://script.google.com/macros/s/AKfycbwI6iIBquFTJuORBgDSdC_gL2C5bEEhzPllK45bPWd88a1WUoofQ9AO0GH5Dsxy4ROV/exec";

/*function primary() {
  console.log("running...")
  if (!accountId) {
    if (window.location.href != "login.html") {
      window.location.href = "login.html"
    }
  } else {
    
    let placeholderElements = []
    let requiredValues = ["notifications"]
    Array.from(document.getElementsByClassName("placeholder")).forEach((element, i) => {
      if ((element.nodeName == "IMG" )*(element.dataset.placeholdertype == "src")) {
        element.src = "dist/img/loading.svg"
      } else if (element.nodeName == "I") {
      } else if (element.dataset.placeholdertype == "textContent") {
        element.textContent = "Loading..."
      }
      placeholderElements.push({element: element, valueName: element.dataset.placeholdervalue, valueType: element.dataset.placeholdertype})
      requiredValues.push(element.dataset.placeholdervalue)
    })
    //console.log(JSON.stringify(requiredValues))
    
    let cachedData = localStorage.getItem('returnedData')
    if (cachedData) {
      cachedData = JSON.parse(cachedData)

      requiredValues.forEach(val => {
        if (cachedData[val]) {
          placeholderElements.forEach(el => {
            if (el.valueName === val) {
              if (el.valueType.startsWith("classList.")) {
                let classAction = el.valueType.split(".")[1]
                el.element.classList[classAction](...cachedData[val])
              } else {
                el.element[el.valueType] = cachedData[val]
              }
            }
          })
        }
      })
      navBarAccess()
      notificationHandler()
    } else {
      cachedData = {}
    }

    processCommand("preauth", JSON.stringify(requiredValues)).then((response) => {
      console.log(response)
      if (response.error) {
        if ((!username)) {
          if (window.location.href != "login.html") {
            window.location.href = "login.html"
          }
        } else {
          if (window.location.href != "reauth.html") {
            window.location.href = "reauth.html"
          }
        }
      } else {     
        Object.keys(response.response).forEach(key => {
          if (!(key == "notifications")+!(cachedData["notifications"])) {
            cachedData[key] = response.response[key]
          } else {
            let notifs = response.response["notifications"]
            Object.keys(notifs).forEach(notifId => {
              if (!cachedData["notifications"][key]) {
                cachedData["notifications"][key] = notifs[key]
              }
            })
          }
        })
        
        localStorage.setItem('returnedData', JSON.stringify(cachedData))
        
        placeholderElements.forEach(el => {
          let value = response.response[el.valueName]
          if (value) {
            if (el.valueType.startsWith("classList.")) {
              let classAction = el.valueType.split(".")[1]
              el.element.classList[classAction](...value)
            } else {
              el.element[el.valueType] = value
            }
          } else {
            el.element[el.valueType] = "N/A"
          }
        })
        if ((window.location.href == "login.html")+(window.location.href == "reauth.html")) {
          window.location.href = "index.html"
        }
      }
      navBarAccess()
      notificationHandler()
    })
  }
}*/

function collectRequiredValues(root) {
  const values = new Set();

  values.add("notifications"); // always fetch notifications
  
  // find data-repeat blocks → add only their key
  root.querySelectorAll("[data-repeat]").forEach(el => {
    values.add(el.dataset.repeat);
  });

  root.querySelectorAll("[data-placeholderkey]").forEach(el => {
    const key = el.dataset.placeholderkey;
    if (key) values.add(key.split(".")[0]); // top-level keys only
  });

  // find all [placeholder] patterns in text/html
  const matches = root.innerHTML.matchAll(/\[([^\]]+)\]/g);
  for (const m of matches) values.add(m[1].split(".")[0]); // top-level keys only

  return Array.from(values);
}

async function primary() {
  NProgress.start();
  
  if (!accountId) {
    location.href = "login.html";
    return;
  }

  // Step 1. Load cached data (if any)
  let data = JSON.parse(localStorage.getItem("returnedData") || "{}");

  // Step 2. Fetch updated data

  const requiredValues = collectRequiredValues(document.body);
  const storedDocumentBody = document.body.cloneNode(true);
  renderTemplate(document.body, data);
  applyAttributePlaceholders(document.body, data);
  navBarAccess();
  notificationHandler();

  const response = await processCommand("preauth", JSON.stringify(requiredValues));

  if (response.error) {
    location.href = username ? "reauth.html" : "login.html";
    return;
  }

  let notificationsData = { ...response.response.notifications, ...data.notifications };
  
  data = { ...data, ...response.response };
  data.notifications = notificationsData;
  console.log(data)
  localStorage.setItem("returnedData", JSON.stringify(data));

  renderTemplate(document.body, data, storedDocumentBody);
  applyAttributePlaceholders(document.body, data);
  navBarAccess();
  notificationHandler();
  NProgress.done();
}

// 🔧 Template rendering engine
function renderTemplate(root, data) {
  // Handle repeat blocks 
  root.querySelectorAll("[data-repeat]").forEach(container => {
    const key = container.dataset.repeat;
    const arr = data[key];
    if (!Array.isArray(arr)) return;

    console.log(arr)

    const templateHTML = container.innerHTML.trim();
    console.log(templateHTML)
    const existingChildren = Array.from(container.children);

    console.log(existingChildren)

    // Reuse existing elements if possible
    arr.forEach((item, index) => {
      item = (typeof item === "object" && item !== null) ? item : { value: item };
      const html = replacePlaceholders(templateHTML, item);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      const newNode = tempDiv.firstElementChild;

      console.log(newNode)
      if (!newNode) return;
      
      if (existingChildren[index]) {
        // Only replace if content has changed
        if (!existingChildren[index].isEqualNode(newNode)) {
          container.replaceChild(newNode, existingChildren[index]);
        }
      } else {
        newNode.dataset["repeatItemIdentifier"] = `${key}:${item.value}:${index}`
        let existingNode = container.parentNode.querySelector(`[data-repeat-item-identifier="${key}:${item.value}:${index}"`)
        console.log(newNode)
        console.log(existingNode)
        if (existingNode) {
          container.parentNode.replaceChild(newNode, existingNode)
        } else {
          container.parentNode.appendChild(newNode);
        }
        
      }
    });

    // Remove excess old elements
    for (let i = arr.length; i < existingChildren.length; i++) {
      container.removeChild(existingChildren[i]);
    }
  });

  // Replace inline placeholders without wiping the whole root
  replaceInlinePlaceholders(root, data);
}

function replaceInlinePlaceholders(root, data) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
  let node;
  while (node = walker.nextNode()) {
    const newText = replacePlaceholders(node.textContent, data);
    if (newText !== node.textContent) {
      node.textContent = newText;
    }
  }
}

// 🧠 Replace [placeholders] in a string
function replacePlaceholders(str, data) {
  return str.replace(/\[([^\]]+)\]/g, (_, key) => {
    const val = resolvePath(data, key);
    return val != null ? val : `[${key}]`;
  });
}

// 🧭 Support nested keys (e.g., user.name)
function resolvePath(obj, path) {
  return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
}

function applyAttributePlaceholders(root, data) {
  root.querySelectorAll("[data-placeholder]").forEach(el => {
    const attr = el.dataset.placeholder;       // e.g., "src", "class", "title"
    const key = el.dataset.placeholderkey;     // e.g., "userHeadshot" or "userCardClasses"
    const val = resolvePath(data, key);

    if (val == null) return;

    // Special handling for class lists
    if (attr === "class") {
      // Option A: replace all classes except the static ones
      el.classList.add(...(Array.isArray(val) ? val : [val]));
      
      /*const staticClasses = el.dataset.staticclasses?.split(/\s+/).filter(Boolean) || [];
      el.className = [...staticClasses, ...(Array.isArray(val) ? val : [val])].join(" ");*/
    }
    // Normal attributes (src, href, title, etc.)
    else {
      el.setAttribute(attr, val);
    }
  });
}


async function formHandler(event) {
  event.preventDefault();

  const form = event.target;
  const submitBtn = form.querySelector("button[type='submit']");
  submitBtn.disabled = true;

  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  // Handle multiple same-named inputs as arrays
  for (const [key, value] of formData.entries()) {
    const all = formData.getAll(key);
    if (all.length > 1) data[key] = all;
  }

  const formName = form.dataset.formName;
  if (!formName) {
    console.error("Form missing data-form-name attribute.");
    submitBtn.disabled = false;
    return;
  }

  try {
    const response = await processCommand(`handleForm.${formName}`, JSON.stringify(data));

    const outputDiv = document.createElement("div");
    outputDiv.className = "form-response";

    if (response.error) {
      outputDiv.innerHTML = linkify(response.error);
    } else {
      const rendered = renderWithTemplate(formName, response.response);
      outputDiv.innerHTML = rendered;
    }

    // Replace any existing response container
    const existing = form.querySelector(".form-response");
    if (existing) existing.replaceWith(outputDiv);
    else form.appendChild(outputDiv);

    if (!response.error) form.reset();

  } catch (err) {
    console.error("Form handler error:", err);
    alert("An unexpected error occurred. See console for details.");
  } finally {
    submitBtn.disabled = false;
  }
}

/**
 * Try to render using a <template data-template-for="formName"> block.
 * Falls back to a default renderer if none exists.
 */
function renderWithTemplate(formName, responseData) {
  const tpl = document.querySelector(`template[data-template-for="${formName}"]`);
  if (!tpl) return defaultRenderer(responseData);

  // Clone the template
  const fragment = tpl.content.cloneNode(true);

  // Replace {{key}} placeholders with data values
  replaceTemplatePlaceholders(fragment, responseData);

  return fragmentToHTML(fragment);
}

/**
 * Recursively replaces {{placeholders}} in text nodes and attributes.
 * Supports arrays — elements with data-repeat="key" will repeat for each array item.
 */
function replaceTemplatePlaceholders(fragment, data) {
  // Handle repeating elements
  fragment.querySelectorAll("[data-repeat]").forEach(el => {
    const key = el.dataset.repeat;
    const arr = data[key];
    if (Array.isArray(arr)) {
      const parent = el.parentNode;
      const template = el.cloneNode(true);
      el.remove();
      arr.forEach(item => {
        const clone = template.cloneNode(true);
        
        const itemData = (typeof item === "object" && item !== null) ? item : { value: item };
        replaceTemplatePlaceholders(clone, itemData);
        parent.appendChild(clone);

        /*replaceTemplatePlaceholders(clone, item);
        parent.appendChild(clone);*/
      });
    }
  });

  // Replace placeholders {{key}}
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT, null, false);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    node.textContent = node.textContent.replace(/\{\{(.*?)\}\}/g, (_, key) => {
      const value = getDeepValue(data, key.trim());
      return value != null ? sanitize(value) : "";
    });
  }

  // Replace placeholders in attributes
  fragment.querySelectorAll("*").forEach(el => {
    for (const attr of el.attributes) {
      const newVal = attr.value.replace(/\{\{(.*?)\}\}/g, (_, key) => {
        const value = getDeepValue(data, key.trim());
        return value != null ? sanitize(value) : "";
      });
      if (newVal !== attr.value) el.setAttribute(attr.name, newVal);
    }
  });
}

/** Convert a DocumentFragment to an HTML string */
function fragmentToHTML(fragment) {
  const div = document.createElement("div");
  div.appendChild(fragment);
  return div.innerHTML;
}

/** Safe deep value access like 'user.name.first' */
function getDeepValue(obj, path) {
  return path.split('.').reduce((acc, key) => (acc && acc[key] != null ? acc[key] : null), obj);
}

/** Fallback renderer (same as before) */
function defaultRenderer(response) {
  if (Array.isArray(response)) {
    const headers = Object.keys(response[0] || {});
    const rows = response.map(obj =>
      `<tr>${headers.map(h => `<td>${sanitize(obj[h])}</td>`).join("")}</tr>`
    ).join("");
    return `<table border="1">
              <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
              <tbody>${rows}</tbody>
            </table>`;
  } else if (typeof response === "object") {
    return `<pre>${escapeHtml(JSON.stringify(response, null, 2))}</pre>`;
  } else {
    return linkify(String(response));
  }
}

/** Utility: basic HTML escaping */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitize(text) {
  let sanitized = DOMPurify.sanitize(text)
  return sanitized
}

async function processCommand(command, args) {
  try {
      console.log(command)
      console.log(args)
      const res = await fetch(API_URL, {
          method: "POST",
          body: JSON.stringify({
              authCode: authCode,
              accountId: accountId,
              command: {
                commandName: command,
                args: args
              }
          })
      });
      const data = await res.json()
      return data
  } catch (err) {
    console.log(err)
    return {
      error: err
    }
  }
}

function linkify(text) {
    // Regex to detect URLs (http, https, www)
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;
    return text.replace(urlRegex, (url) => {
        let href = url;
        if (!href.startsWith('http')) {
            href = 'http://' + href; // Support bare www. links
        }
        return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}

function navBarAccess() {
  try {
    if (JSON.parse(localStorage.getItem('returnedData')).permissionsIa0.includes("text-success")) {
      document.getElementById("iaNav").style.display = ""
    }
    if (JSON.parse(localStorage.getItem('returnedData')).permissionsSis0.includes("text-success")) {
      document.getElementById("sisNav").style.display = ""
    }
    if (JSON.parse(localStorage.getItem('returnedData')).permissionsLcpd1.includes("text-success")) {
      document.getElementById("sisNav").style.display = ""
      document.getElementById("iaNav").style.display = ""
    }
  } catch (err) {
    console.log(err)
  }
}

function notificationHandler(notifId) {
  if (notifId) {
    let returnedData = JSON.parse(localStorage.getItem('returnedData'))
    returnedData.notifications[notifId].read = true
    localStorage.setItem('returnedData', JSON.stringify(returnedData))
    if (document.getElementById(`notifElA-${notifId}`)) {
      document.getElementById(`notifElA-${notifId}`).remove()
    }
    if (document.getElementById(`notifElB-${notifId}`)) {
      document.getElementById(`notifElB-${notifId}`).remove()
    }
    notificationHandler()
  } else {
    let returnedData = JSON.parse(localStorage.getItem('returnedData'))
    if (!returnedData) return;
    let notifs = returnedData.notifications
    if (notifs) {
      let unreadNotifsCount = 0
      let unreadNotifs = {}
      Object.keys(notifs).forEach(key => {
        if (!notifs[key].read) {
          unreadNotifsCount += 1
          unreadNotifs[key] = notifs[key]
        }
      })

      Object.keys(unreadNotifs).forEach(key => {
        let notif = unreadNotifs[key]
        let notifElement = document.createElement("a")
        notifElement.classList.add("dropdown-item")
        notifElement.href = "index.html#notifications-dashboard"
        notifElement.id = `notifElA-${key}`
        notifElement.innerHTML =
          `<!-- Message Start -->
          <div class="media">
            <img src="${notif.icon}" alt="User Avatar" class="img-size-50 mr-3 img-circle">
            <div class="media-body">
              <h3 class="dropdown-item-title">
                ${notif.title}
              </h3>
              <p class="text-sm">${notif.message}</p>
              <p class="text-sm text-muted"><i class="far fa-clock mr-1"></i> ${new Date(notif.timestamp).toLocaleString("zh-CN")}</p>
            </div>
          </div>
          <!-- Message End -->`

        //notifElement.onclick = () => {notificationHandler(key);notifElement.remove()}
        document.getElementById("notif-dropdown-list").textContent = ""
        document.getElementById("notif-dropdown-list").appendChild(notifElement)
        let divider = document.createElement("div")
        divider.classList.add("dropdown-divider")
        document.getElementById("notif-dropdown-list").appendChild(divider)


        if (document.getElementById("notifications-dashboard")) {
          notifElement = document.createElement("div")
          notifElement.classList.add("post")
          notifElement.id = `notifElB-${key}`
          notifElement.innerHTML =
              `<div class="user-block">
                <img class="img-circle img-bordered-sm" src="${notif.icon}" alt="user image">
                <span class="username text-dark">
                  ${notif.title}
                  <button type="button" class="btn float-right btn-tool" onclick="notificationHandler(${key})">Dismiss</button>
                </span>
                <span class="description">${new Date(notif.timestamp).toLocaleString("zh-CN")}</span>
              </div>
              <!-- /.user-block -->
              <p>
                ${(notif.message.length > 135) ? (notif.message.substring(0, 134)) + "..." : (notif.message)}
              </p>`
          document.getElementById("notifications-dashboard").textContent = ""
          document.getElementById("notifications-dashboard").appendChild(notifElement)
        }
      })

      if (unreadNotifsCount > 0) {
        document.getElementById("notif-dropdown-count").textContent = unreadNotifsCount
        document.getElementById("notif-dropdown-count").style.display = ""
      } else {
        document.getElementById("notif-dropdown-count").style.display = "none"
        document.getElementById("notif-dropdown-list").innerHTML =
          `<a href="#" class="dropdown-item">
            <!-- Message Start -->
            <div class="media">
              <div class="media-body">
                <p class="text-sm text-center">No new notifications.</p>
              </div>
            </div>
            <!-- Message End -->
          </a>`
        if (document.getElementById("notifications-dashboard")) {
          document.getElementById("notifications-dashboard").innerHTML =
            `<div class="text-center">
              <p>
                No new notifications.
              </p>
            </div>`
        }
      }
    }
  }

  if (document.getElementById("notifications-dashboard")) {
    if (document.getElementById("notifications-dashboard").innerHTML == "") {
      document.getElementById("notifications-dashboard").innerHTML =
        `<div class="text-center">
          <p>
            No new notifications.
          </p>
        </div>`
    }
  }
  if (document.getElementById("notif-dropdown-list").innerHTML == "") {
    document.getElementById("notif-dropdown-list").innerHTML =
      `<a href="#" class="dropdown-item">
        <!-- Message Start -->
        <div class="media">
          <div class="media-body">
            <p class="text-sm text-center">No new notifications.</p>
          </div>
        </div>
        <!-- Message End -->
      </a>`
  }
}

async function auth() {
  authCode = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)
  localStorage.setItem("authCode", authCode)
  document.getElementById("signinbtn").disabled = true
  try {
      const res = await fetch(API_URL, {
          method: "POST",
          body: JSON.stringify({
              authCode: authCode,
              command: {
                commandName: "auth",
              }
          })
      });
      const data = await res.json()
      console.log(data)
      if (!data.error) {
        openAuth(data.response)
      } else {
        throw new Error("Server error. Please try again later.")
      }
  } catch (err) {
    let div = document.createElement("div")
    div.textContent = err.message
    if (document.getElementById("footer-text")) {
      document.getElementById("footer-text").appendChild(div) 
    } else {
      document.getElementById("card-body").appendChild(div) 
    }
    document.getElementById("signinbtn").disabled = false
  }
}

function openAuth(nonce) {
  console.log(nonce)
  
  const oauthLink = `https://apis.roblox.com/oauth/v1/authorize?client_id=1177318814559888844&redirect_uri=${encodeURIComponent("http://localhost:5500/redirect.html")}&scope=openid&response_type=code&nonce=${encodeURIComponent(nonce)}`
  
  let div = document.createElement("div")
  div.textContent = "Please continue in the ROBLOX verification window."
  if (document.getElementById("footer-text")) {
    document.getElementById("footer-text").appendChild(div) 
  } else {
    document.getElementById("card-body").appendChild(div) 
  }

  newWindow = window.open(oauthLink, "_blank", "width=600,height=700")
  if (newWindow) {
    newWindow.focus();
    window.addEventListener('message', function(event) {
      if (event.origin !== window.location.origin) return;
      console.log(event.origin)

      console.log('OAuth complete:', event.data);
      newWindow.close();

      let authData = JSON.parse(event.data)
      console.log(authData)
      console.log(authData.success)
      if (authData.success) {
        localStorage.setItem('accountId', authData.accountId)
        accountId = authData.accountId
        localStorage.setItem('username', authData.username)
        username = authData.username
        window.location.href = "index.html"
      } else {
        let div = document.createElement("div")
        div.textContent = `Invalid or expired request. Please try again. If this issue persists, contact Vasek_Stolba.`
        if (document.getElementById("footer-text")) {
          document.getElementById("footer-text").appendChild(div) 
        } else {
          document.getElementById("card-body").appendChild(div) 
        }
        document.getElementById("signinbtn").disabled = false
      }
    });
    } else {
        let div = document.createElement("div")
        div.textContent = `Popup blocked! Please allow popups for this site.`
        if (document.getElementById("footer-text")) {
          document.getElementById("footer-text").appendChild(div) 
        } else {
          document.getElementById("card-body").appendChild(div) 
        }
        document.getElementById("signinbtn").disabled = false
    }
    document.getElementById("signinbtn").disabled = true
}