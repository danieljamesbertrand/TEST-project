var watchID;

var version = "1.01";

var thresh = 0.0001;
var minPressure = 0;
var maxPressure = 600;

var minTemperature = -40;
var maxTemperature = 150;

var minVolume = 0;
var maxVolume = 100;

var isiPad;
var isiPhone;
var geoOptions;
var db;

var lastLocationLong;
var lastLocationLat;


var DBRec;          // last inserted record in QRData DB table
var DBRecSLog;      // last inserted record in QRLog DB table

var curRecID;

var numDBRecords;

var sendReport = 0;

function loadPage() {
    var xmlhttp = new XMLHttpRequest();

    // Callback function when XMLHttpRequest is ready
    xmlhttp.onreadystatechange=function(){
        if (xmlhttp.readyState === 4){
            if (xmlhttp.status === 200) {
                document.getElementById('container').innerHTML = xmlhttp.responseText;
            }
        }
    };
    xmlhttp.open("GET", 'https://raw.github.com/danieljamesbertrand/js/master/gasfrac.html' , true);
    xmlhttp.send();
}

function getMac() {
// Check if mac address is available
window.MacAddressPlugin(
    function (result) {
            window.localStorage.setItem("macAddress",result);
            window.localStorage.setItem("uuid",result);
             window.localStorage.setItem("deviceIsOnline",1);
             macAdd.innerHTML = ('<p>'+result+'</p>');
            SLog('Mac Address:'+result);
    },function (result) {
             window.localStorage.setItem("deviceIsOnline",0);
            SLog('error getting mac address! :'+result);
            mac.innerHTML = ('<p>'+result+'</p>');
});
}

function heartbeat() {

}

function geo() {
navigator.geolocation.getCurrentPosition(function (position) {

window.localStorage.setItem("latitude",position.coords.latitude);
window.localStorage.setItem("longitude",position.coords.longitude);
window.localStorage.setItem("altitude",position.coords.altitude);
window.localStorage.setItem("accuracy",position.coords.accuracy);
window.localStorage.setItem("altitudeAccuracy",position.coords.altitudeAccuracy);
window.localStorage.setItem("heading",position.coords.heading);
window.localStorage.setItem("speed",position.coords.speed);
window.localStorage.setItem("timestamp",position.timestamp);

SLog("satellite lock: LAT("+position.coords.latitude+") : LONG ("+position.coords.longitude+")");
SLog("satellite accuracy: +/- ("+position.coords.accuracy+")");
SLog("altitude accuracy: +/- ("+position.coords.altitudeAccuracy+")");
SLog("heading: ("+position.coords.heading+")");
SLog("speed: ("+position.coords.speed+")");

}
,
function (error) {
    alert('code: '    + error.code    + '\n' +'message: ' + error.message + '\n');
    // log somewhere that we can't lock on location
    var media = new Media("nogps.mp3");
media.play();

    window.localStorage.setItem("geolock",false);
},{
timeout: 5000,
maximumAge: 30000,
enableHighAccuracy: true });
}


function orient() {
    if (window.orientation == 0 || window.orientation == 180) {
        $("body").attr("class", "portrait");
        orientation = 'portrait';
     
        return false;
    }
    else if (window.orientation == 90 || window.orientation == -90) {
        $("body").attr("class", "landscape");
        orientation = 'landscape';
     
        return false;
    }
}
     
function onBackKeyDown()
{
SLog("Hit Back Key - exiting app()");
 navigator.app.exitApp();

 db.close();
}

function savejID() {

var qak =$('#jidSelect :selected').text();
//alert(qak);
window.localStorage.setItem("jID",qak);
$("#jID").html(qak);

}

function addslashes( str ) {
    return (str+'').replace(/([\\"'])/g, "\\$1").replace(/\0/g, "\\0");
}

function SLog(messageToLog) {

createLogTable();

var dt = new Date();
var curTimeStamp = dt.getFullYear()+
                   pad2(dt.getMonth()+1)+
                   pad2(dt.getDate())+
                   pad2(dt.getHours())+
                   pad2(dt.getMinutes())+
                   pad2(dt.getSeconds());


var logSQL = "INSERT INTO QRLog (timestamp,logEntry) VALUES ('"+curTimeStamp+"','"+messageToLog+"')";

    db.transaction(
    function(tx) {
       tx.executeSql(logSQL,[], function(transaction,resultSet) {
            DBRecSLog = resultSet.insertId;
            console.log(curTimeStamp+" : "+messageToLog);
            },function (transaction, error) {
                // insert failed!
                console.log('When trying '+logSQL);
                console.log('Error Inserting Log Entry - Code:'+error.code);
       }
    );
    },function (transaction, error) {
        console.log("INSERT QRData: db.tx failed,code:"+error.code+", reason:"+error.message);
    }, function (transaction, result) {
        console.log("INSERT QRData: db.tx ok");
    }
); // db.transaction


}

function eraseLogs() {

// erase the phone logs.


var logSQL = "DROP TABLE QRLog;";

    db.transaction(
    function(tx) {
       tx.executeSql(logSQL,[] ,function(transaction,resultSet) {
            },function (transaction, error) {
                // delete failed!
                console.log('When trying '+logSQL);
                console.log('Error Deleting records... - Code:'+error.code);
       }
    );
    },function (transaction, error) {
        console.log("eraseLogs: db.tx failed,code:"+error.code+", reason:"+error.message);
    }, function (transaction, result) {
        console.log("eraseLogs: db.tx ok");
    }
); // db.transaction


}

function loadServerToTalkTo() {

// if we can't connect here, set a default of "206.174.197.234"

var oXMLHttpRequest = new XMLHttpRequest;
var req = "http://206.174.197.234/getserver.php";

var jobIDselect = '<select class="controls" name = "jidSelect" id = "jidSelect" onchange="savejID()">';
jobIDselect = jobIDselect+'<option value=null>CHOOSE A JOB ID</option>\n';
oXMLHttpRequest.open("GET", req, false);
oXMLHttpRequest.setRequestHeader("Content-type","application/x-www-form-urlencoded");
oXMLHttpRequest.onreadystatechange = function() {
    if (this.readyState == 4  && this.status==200) {
         // we are finished with the request. Let's look inside...

        var obj = JSON.parse(this.responseText);
        
            for (var i = 0;i<obj.total;i++) {
               var m = obj.rows[i].SERVERIP;
               window.localStorage.setItem("serverIP",m);
               console.log("Stored "+obj.rows[i].SERVERIP+" as server to talk to.");
            }
        }
        // this.readyState == 4
    }
        if (this.readyState == 2  && this.status==404) {
            SLog("Cannot connect to server trying to load the default server IP: defaulting to 206.174.197.234"); // log an error message indicating inability to connect.
            
            // set a default to retry to: 206.174.197.234
            
            window.localStorage.setItem("serverIP","206.174.197.234");
        } // this.readyState == 2
    // function()
oXMLHttpRequest.send(null);

}

function loadJobIDs() {

window.localStorage.setItem("serverIP","206.174.197.234");

if (window.localStorage.getItem("deviceIsOnline") == 1) {
    var oXMLHttpRequest = new XMLHttpRequest;
    var req = "http://"+window.localStorage.getItem("serverIP")+"/getjids.php";
    var jobIDselect = '<select class="controls" name = "jidSelect" id = "jidSelect" onchange="savejID()">';
    jobIDselect = jobIDselect+'<option value=null>CHOOSE A JOB ID</option>\n';
    oXMLHttpRequest.open("GET", req, false);
    oXMLHttpRequest.setRequestHeader("Content-type","application/x-www-form-urlencoded");
    oXMLHttpRequest.onreadystatechange = function() {
        if (this.readyState == 4  && this.status==200) {
             // we are finished with the request. Let's look inside...

            var obj = JSON.parse(this.responseText);
            
                for (var i = 0;i<obj.total;i++) {
                   var m = obj.rows[i].WORKORDERNUMBER_and_OPERATOR;
                   jobIDselect = jobIDselect + '<option ';
                   if (m == window.localStorage.getItem("jID")) {
                      jobIDselect = jobIDselect + ' selected';
                   }
                   
                   jobIDselect = jobIDselect + ' value=\"'+m+'\">'+m+'</option>\n';
                }
            jobIDselect = jobIDselect +'</select>';
            
        //
        // store jobIDSelect list in a localStorage variable. Why? In case we go offline and can't get it from the server, that's why.
        //
        window.localStorage.setItem("localjobIDselect",jobIDselect);

            $("#jIDinput").html(jobIDselect).trigger('create');
            
            
            }
            // this.readyState == 4
            if (this.readyState == 2  && this.status==404) {
                SLog("Cannot connect to server trying to load the jobID list."); // log an error message indicating inability to connect.
            } // this.readyState == 2
            
        }
        // function()
    oXMLHttpRequest.send(null);
} 
// if (window.localStorage.getItem("deviceIsOnline") == 1)

else {
       $("#jIDinput").html(window.localStorage.getItem("localjobIDselect")).trigger('create');;
console.log('using '+window.localStorage.getItem("localjobIDselect"));
}
}

function loadEvents() {

window.localStorage.setItem("serverIP","206.174.197.234");

if (window.localStorage.getItem("deviceIsOnline") == 1) {
    // now go get events.
    var oXMLHttpRequest2 = new XMLHttpRequest;
    var req2 = "http://"+window.localStorage.getItem("serverIP")+"/getevents.php";
    var eventSelect = '<select class="controls" name = "evnt" id = "evnt" onchange="saveEvnt()">';
    // add null placeholder
    eventSelect = eventSelect+'<option value=null>1. CHOOSE AN EVENT</option>\n';
    oXMLHttpRequest2.open("GET", req2, false);
    oXMLHttpRequest2.setRequestHeader("Content-type","application/x-www-form-urlencoded");
    oXMLHttpRequest2.onreadystatechange = function() {
        if (this.readyState == 4  && this.status==200) {
             // we are finished with the request. Let's look inside...

            var obj2 = JSON.parse(this.responseText);
                for (var i = 0;i<obj2.total;i++) {
                   var m = obj2.rows[i].EVENT_NAME;
                   var n = obj2.rows[i].EVENT_TYPE;
                   var o = obj2.rows[i].EVENT_SK;
                   
                   eventSelect = eventSelect+'<option';
                   if (m == window.localStorage.getItem("evnt")) {
                      eventSelect = eventSelect + ' selected';
                   }
                   eventSelect = eventSelect + ' value=\"'+o+'\">'+addslashes(m)+'</option>\n';
                   
                }
        eventSelect = eventSelect + '</select>';
        //
        // store eventSelect list in a localStorage variable. Why? In case we go offline and can't get it from the server, that's why.
        //
        window.localStorage.setItem("localEventSelect",eventSelect);

        $('#eventDiv').html(eventSelect).trigger('create');

        }
        if (this.readyState == 2 && this.status==404) {
        // cannot connect to the server.
         SLog("Cannot connect to server trying to load the events list."); // log an error message indicating inability to connect.
        }
        // this.readyState == 4
        }
        
        // function()
    oXMLHttpRequest2.send(null);
}
// if (window.localStorage.getItem("deviceIsOnline") == 1)
else {
    $('#eventDiv').html(window.localStorage.getItem("localEventSelect")).trigger('create');
console.log('using '+window.localStorage.getItem("localEventSelect"));
}

}
//**************************************************************************
// EXPERIMENTAL

function customFromServer() {

// 
}
//**************************************************************************

function reportingMode() {

// ummm.... are we online?

if (window.localStorage.getItem("deviceIsOnline") == 1) {

// now go get the "must report in" list and see if I am on it.
var oXMLHttpRequest2 = new XMLHttpRequest;
var req2 = "http://206.174.197.234/getReportingList.php";


// add null placeholder
oXMLHttpRequest2.open("GET", req2, false);
oXMLHttpRequest2.setRequestHeader("Content-type","application/x-www-form-urlencoded");
sendReport = 0;
oXMLHttpRequest2.onreadystatechange = function() {

    if (this.readyState == 4  && this.status==200) {
         // we are finished with the request. Let's look inside...

        var obj2 = JSON.parse(this.responseText);
            for (var i = 0;i<obj2.total;i++) {
               var UUIDToReport = obj2.rows[i].UUIDToReport;
               var deleteAfterReport = obj2.rows[i].deleteAfterReport;
               if (UUIDToReport == window.localStorage.getItem("macAddress")) {
                    sendReport = 1;
                    console.log("I am on the must-report list!");
               }
               // end if
            }
            // end for
            
if (sendReport == 1) {
     var logSQL = "SELECT * FROM QRLog";
    console.log(logSQL);
db.transaction(
  function(tx){
    tx.executeSql("SELECT * FROM QRLog",[],function (tx,res) {
      console.log("Success - SELECT * FROM QRLog selected "+res.rows.length+" rows.");
var oXMLHttpRequest3 = new XMLHttpRequest;

for (var i=0;i<res.rows.length;i++) {
                                   
console.log("ID:"+res.rows.item(i).id+" ts: "+res.rows.item(i).timestamp+" Entry: "+res.rows.item(i).logEntry);
var req3 = "http://"+window.localStorage.getItem("serverIP")+"/sendReport.php?uuid="+encodeURIComponent(window.localStorage.getItem("macAddress"))+"&ts="+res.rows.item(i).timestamp+"&logEntry="+encodeURIComponent(res.rows.item(i).logEntry);
console.log(req3);

oXMLHttpRequest3.open("GET", req3, false);
oXMLHttpRequest3.setRequestHeader("Content-type","application/x-www-form-urlencoded");
oXMLHttpRequest3.onreadystatechange = function() {
console.log('sending logs: readyState: '+this.readyState+' status: '+this.status);
                            
if (this.readyState == 4) {
if (this.status == 200) {
    var obj3 = JSON.parse(this.responseText);
    console.log('Success: '+obj3.success);
}
}
// end if (this.readyState == 4  && this.status==200) 
}
// end oXMLHttpRequest3.onreadystatechange = function()
                            
                            oXMLHttpRequest3.send(null);
                            oXMLHttpRequest3.close;
                            }
                            },
                            function() {}
                           );
                            },
                   function (e) {console.log("FAIL: db.SLog failed, reason:"+e.message);},
                   function () {console.log("db.SLog: SUCCESS: db.tx ok");}
);


        $('#indicator').html("<p>COMPLETED OFFLINE REPORTING..</p>");
        $('#indicator').html("<center><img align='middle' width='20' height='20' src='./img/green.png'></center>");
        
    }
    
    }
    if (this.status==404) {
    // cannot connect to the server.
     SLog("Cannot connect to server to see if I am supposed to report."); // log an error message indicating inability to connect.
    }
    // this.readyState == 4
    }
    // function()
oXMLHttpRequest2.send(null);
oXMLHttpRequest2.close;

}

window.location.replace("#p1");
}

function MacAddressSuccess (result) {
window.localStorage.setItem("macAddress",result);
 macAdd.innerHTML = ('<p>'+result+'</p>');
 mac.innerHTML = ('<p>'+result+'</p>');
//SLog('Mac Address:'+result);
}

function MacAddressError (result) {
 macAdd.innerHTML = ('<p>NOMACADDRESS</p>');
//SLog('error getting mac address! :'+result);
//window.localStorage.setItem("macAddress","NOMACADDRESS");

}

function createLogTable() {

var sqllog = 'CREATE TABLE IF NOT EXISTS QRLog(id INTEGER PRIMARY KEY AUTOINCREMENT,timestamp TEXT,logEntry TEXT);';

    db.transaction(function(tx){
                   tx.executeSql(sqllog,[],function () {
                                    console.log("SUCCESS: CREATE QRLog TABLE");
                                 },
                                 function () {
                                    console.log("ERROR : CREATE QRLog TABLE");
                                 }
                                 );
                   },
                   function (e) {
                        console.log("FAIL: db.tx failed, reason:"+e.message);
                   },
                   function () {
                        console.log("103: SUCCESS: db.tx ok");
                   }
);
}

function createQRDataTable() {

var sql = 'CREATE TABLE IF NOT EXISTS QRData(id INTEGER PRIMARY KEY AUTOINCREMENT,jID TEXT, username TEXT, passw TEXT,lvl1 TEXT, cde TEXT, desc TEXT , timestamp TEXT, latitude TEXT, longitude TEXT, altitude TEXT, heading TEXT, temp TEXT, pressure TEXT, evnt TEXT);';

    window.localStorage.setItem("Status","");

    window.localStorage.setItem("Status",navigator.connection.type);
    db.transaction(function(tx){
                   tx.executeSql(sql,[], function () {
                                    console.log("SUCCESS: CREATE QRData TABLE");
                                 },
                                 function () {
                                    console.log("ERROR : CREATE QRData TABLE");
                                 }
                                 );
                   },
                   function (e) {
                        console.log("FAIL: Create Table QRData db.tx failed, reason:"+e.message);
                   },
                   function () {
                        console.log("Create Table QRData: SUCCESS: db.tx ok");
                   }
);
}

function onDeviceReady() {
numSQLrecs();
getMac();
createLogTable();
createQRDataTable();
geo();
    
window.localStorage.setItem("isiPad",false);
window.localStorage.setItem("isiPhone",false);

 // is this an IPad ? an iPhone?
window.localStorage.setItem("isiPad",(navigator.userAgent.match(/iPad/i) != null));
window.localStorage.setItem("isiPhone",(navigator.userAgent.match(/iPad/i) != null));
//turn the button on
window.localStorage.setItem("username","gasfrac");
window.localStorage.setItem("password","11gasfrac11");
//alert(window.localStorage.getItem("jID"));

 jID.innerHTML = '<p>'+window.localStorage.getItem("jID")+'</p>';
 console.log("job ID:"+window.localStorage.getItem("jID"));
 jIDinput.value = window.localStorage.getItem("jID");


navigator.geolocation.getCurrentPosition(geolocationSuccess,geolocationFailure,{enableHighAccuracy: true});

window.localStorage.setItem("uuid",window.localStorage.getItem("macAddress"));
window.localStorage.setItem("deviceversion",device.version);

window.localStorage.setItem("temp",-100);
window.localStorage.setItem("pressure",-1);
window.localStorage.setItem("lvl1",-1);

getjID();
getBulkerID();

jID.innerHTML = '<font size="-1">jID:<b>'+window.localStorage.getItem("jID")+'</b></font>'; // job ID
window.localStorage.setItem("uname","gasfrac");
window.localStorage.setItem("psswrd","11gasfrac11");

//$('#indicator').html('<center><img align="middle" width="20" height="20" src="./img/green.png"></center>');
// this creates long-winded select inputs.
generatePressureSelect();
generateTemperatureSelect();
generateVolumeSelect();


// 1. check if a data dump is required from the server. Am i on the list?
// 2. yes. take all of the SQL records in this SQLITE3 database table called QRLog and send them to the server.
// 3. Am I supposed to delete my data now? Do it.

//reportingMode();

uploadUnsentRecords();

}

function scannerFailure(e) {
    //SLog("Scanner fail: " + e.message);
    console.log("Scanner fail: " + e.message)
    window.location.replace('#p1');
}


function scannerSuccess(result) {
    if (result.cancelled) {
        SLog('Scan button hit, user hit cancel!');
        window.location.replace('#p1');
        
    } else {
    SLog('Scan button hit, scanner returned: '+result.text);

        window.localStorage.setItem("cde",(result.text).substring(0,5));
        cde.innerHTML = '<b>'+(result.text).substring(0,5)+'</b>';
        jID.innerHTML = '<b>'+window.localStorage.getItem("jID");
        jID2.innerHTML = '<b>'+window.localStorage.getItem("jID");
        window.location.replace('#p2');
    }
}

function scanBarcode() {

    var moo = window.localStorage.getItem("jID");
// can't scan if jID is empty
    if (moo.length > 0) {
       window.plugins.barcodeScanner.scan(scannerSuccess,scannerFailure);
    } else {
     alert('job ID cannot be empty!');
    window.location.replace('#p1');
    }
}


function init() {
}

function onLoad() {
getMac();


// This dynamically loads the html portion 
loadPage();

loadServerToTalkTo();

loadJobIDs();
loadEvents();


//Initialize engineering values on page load
window.localStorage.setItem("lvl1",-1)
window.localStorage.setItem("temp",-100)
window.localStorage.setItem("pressure",-1)

window.location.replace('#p1');
}

function getjID() {

var duk = window.localStorage.getItem("jID");
document.getElementById('jID').innerHTML = duk;
document.getElementById('jID2').innerHTML = duk;
window.location.replace('#p2');

}

function getBulkerID() {

var duk = window.localStorage.getItem("cde");
document.getElementById('cde').innerHTML = 'Bulker:'+duk;
window.location.replace('#p2');

}

function saveEvnt() {
var duk = document.getElementById('evnt').selectedIndex;
var qak = document.getElementById('evnt').options[duk].text;
window.localStorage.setItem("evnt",qak);
window.location.replace('#p2');
}

function setVolume() {
var duk = document.getElementById('volumeSelect').selectedIndex;
var qak = document.getElementById('volumeSelect').options[duk].text;
window.localStorage.setItem("lvl1",qak);
window.location.replace('#p2');
}

function setTemp() {
var duk = document.getElementById('temperatureSelect').selectedIndex;
var qak = document.getElementById('temperatureSelect').options[duk].text;
window.localStorage.setItem("temp",qak);
window.location.replace('#p2');

}

function setPressure() {
var duk = document.getElementById('pressureSelect').selectedIndex;
var qak = document.getElementById('pressureSelect').options[duk].text;
window.localStorage.setItem("pressure",qak);
window.location.replace('#p2');

}

function pad2(number) {
    return ((number < 10 ? '0' : '') + number);
}

function numSQLrecs() {

   var sqlstr = 'SELECT COUNT(*) AS cnt FROM QRData';

   db.transaction(function(tx) {
   tx.executeSql(sqlstr,[],function(tx, res) {
                    dbrecords0.innerHTML = "<p>"+res.rows.item(0).cnt+"</p>";
                    dbrecords.innerHTML = "<p>"+res.rows.item(0).cnt+"</p>";
                    recsInDB.innerHTML = "<p>Saved Scans:"+res.rows.item(0).cnt+"</p>";
                    numDBRecords = res.rows.item(0).cnt;
                    window.localStorage.setItem("recordsInTable",res.rows.item(0).cnt);
                    //SLog('I found '+res.rows.item(0).cnt+' records!');

                 },
                 function(transaction, error) {
                   console.log("ERROR: failure selecting count(*) -> Error:" + e);
                 
                 }),
                   function (transaction, error) {
                   console.log("ERROR many records");
                   },
                   function (result) {
                   console.log("SUCCESS!"+result.text);
                   }                 
   });
   dbrecords.innerHTML = "&nbsp;"+numDBRecords;
  return numDBRecords;
} // end numSQLrecs


function deleteRec(recNum) {

db.transaction(function(tx) {
      indicator.innerHTML = '<font size = "-1">DELETE FROM QRData WHERE id='+recNum+'</font>';
      tx.executeSql("DELETE FROM QRData WHERE id='"+recNum+"';", [],
          function (result) {
             // success deleting the record
             numSQLrecs();
             SLog("Deleted record :"+recNum);
             return true;
          },function () {
             //failure deleting the record
             SLog("Failure deleting record in deleteRec :"+recNum);
             return false;
          }
          );
      },
      function () {
         //info.innerHTML = "DEDBValues: db.tx failed.";
      },
      function () {
         //info.innerHTML = "DELDBValues: db.tx ok.";
      }
    );
}

function deleteLogRec(recNum) {

db.transaction(function(tx) {
      indicator.innerHTML = '<font size = "-1">DELETE FROM QRLog WHERE id='+recNum+'</font>';
      tx.executeSql("DELETE FROM QRLog WHERE id='"+recNum+"';", [],
          function (result) {
             // success deleting the record
             //
             // update the number of records next to the db icon at top left.
             //
             numSQLrecs();
             console.log("Deleted record :"+recNum);
             return true;
          },function () {
             //failure deleting the record
             console.log("Failure deleting record in deleteLogRec :"+recNum);
             return false;
          }
          );
      },
      function () {
         //info.innerHTML = "DEDBValues: db.tx failed.";
      },
      function () {
         //info.innerHTML = "DELDBValues: db.tx ok.";
      }
    );
}

function insertRec(strData) {

    db.transaction(
    function(tx) {tx.executeSql(strData,[], function(transaction,resultSet) {
       // we need to remember the ID so we can delete that record after it is sent successfully.
       DBRec = resultSet.insertId;
       //SLog('insertRec, last insert: '+resultSet.insertId);
       numSQLrecs();
       dbrecords.innerHTML = numDBRecords;
       
       },function (transaction, error) {
       // insert failed!
       //SLog('Code:'+error.code);
       }
       );
    }, function (transaction, error) {
   console.log("INSERT QRData: db.tx failed,code:"+error.code+", reason:"+error.message);
}
, function (transaction, result) {
   console.log("INSERT QRData: db.tx ok");
}
); // db.transaction

}

function nullErrorHandler() {
}


    
function uploadToServer() {

if (window.localStorage.getItem("evnt") != null) {} else {
   alert("You must choose an event!");
   return;
}

if ((window.localStorage.getItem("lvl1")) != -1) {} else {
   alert("Volume not set!");
   return;
}

if ((window.localStorage.getItem("temp")) != -100) {} else {

   alert("Temperature not set!");
   return;
}

if ((window.localStorage.getItem("pressure")) != -1) {} else {
   alert("Pressure not set!");
   return;
}

document.getElementById("sendData").disabled=true;
// turn off the button
window.location.replace('#p2');

navigator.geolocation.getCurrentPosition(geolocationSuccess,geolocationFailure,{enableHighAccuracy: true});


var dt = new Date();
var timestamp = dt.getFullYear()+ pad2(dt.getMonth()+1)+ pad2(dt.getDate())+ pad2(dt.getHours())+ pad2(dt.getMinutes())+ pad2(dt.getSeconds());

var sqlstr = "INSERT INTO QRData (jID,username,passw,lvl1,cde,desc,timestamp,latitude,longitude,altitude,heading,temp,pressure,evnt) VALUES ('"+
            window.localStorage.getItem("jID")+      "','"+
            'gasfrac'+                        "','"+
            '11gasfrac11'+                    "','"+
            window.localStorage.getItem("lvl1")+     "','"+
            window.localStorage.getItem("cde")+      "','"+
            window.localStorage.getItem("macAddress")    +"','"+
            timestamp+                        "','"+
            window.localStorage.getItem("latitude") +"','"+
            window.localStorage.getItem("longitude")+"','"+
            window.localStorage.getItem("altitude") +"','"+
            window.localStorage.getItem("heading")  +"','"+
            window.localStorage.getItem("temp")     +"','"+
            window.localStorage.getItem("pressure") +"','"+
            window.localStorage.getItem("evnt")+"');";

console.log(sqlstr);
insertRec(sqlstr);  // this sets last inserted record = global var DBRec
numSQLrecs();

// now DBRec has the last.insertID


// There is NO sense in doing this unless we have connectivity!

if (window.localStorage.getItem("deviceIsOnline") == 1) {

var oXMLHttpRequest = new XMLHttpRequest;
        
var req = "http://"+window.localStorage.getItem("serverIP")+"/gf1.php?"+
  "jID="+encodeURIComponent(window.localStorage.getItem("jID"))+
  "&uname=gasfrac"+
  "&passwd=11gasfrac11"+
  "&level="+window.localStorage.getItem("lvl1")+
  "&cde="+window.localStorage.getItem("cde")+
  "&desc="+window.localStorage.getItem("uuid")+
  "&ts="+timestamp+
  "&lat="+window.localStorage.getItem("latitude")+
  "&long="+window.localStorage.getItem("longitude")+
  "&alt="+window.localStorage.getItem("altitude")+
  "&heading=-1"+
  "&temp="+window.localStorage.getItem("temp")+
  "&pressure="+window.localStorage.getItem("pressure")+
  "&event="+window.localStorage.getItem("evnt");
 
   oXMLHttpRequest.open("GET", req, false);
   
    oXMLHttpRequest.onreadystatechange = function()
    {

indicator.innerHTML = '<font size = "-1">WAITING FOR SERVER RESPONSE...</font>';

if (this.readyState == 4 && this.status==200)
        {
           // we are finished with the request. Let's look inside...
            var myResponse = JSON.parse(this.responseText);
            SLog('response:'+this.responseText);

            indicator.innerHTML = '<font size = "-1">.....</font>';
if ((myResponse.success == true) || (myResponse.errmsg == "duplicate")){
   if (myResponse.errmsg == "duplicate") {
        indicator.innerHTML = '<font size = "-1"><center><img align="left" width="10" height="10"  src="img/yellow.png">DUPLICATE</center></font>';
       SLog('duplicate!');
   }
   else {
    indicator.innerHTML = '<font size = "1"><center><img align="left" width="10" height="10"  src="img/green.png">SEND OK!</center></font>';
       SLog('success = ok sending record marked with timestamp '+timestamp);
       document.getElementById("sendData").disabled=false;
        // turn the send button back on
var header = '<BusinessRequisition><BusinessRequisitionHeader><ProjectName>GasFrac Asset Monitoring</ProjectName><WorkflowName>UpdateScannedData</WorkflowName></BusinessRequisitionHeader><RequisitionDetails><Device>';

var footer = '</Device></RequisitionDetails></BusinessRequisition>';

var xmlStr = header+'<jID>'+window.localStorage.getItem("jID")+'</jID>'+
'<level>'+window.localStorage.getItem("lvl1")+'</level>'+
'<cde>'+window.localStorage.getItem("cde")+'</cde>'+
'<desc>'+window.localStorage.getItem("uuid")+'</desc>'+
'<ts>'+timestamp+'</ts>'+
'<latitude>'+window.localStorage.getItem("latitude")+'</latitude>'+
'<longitude>'+window.localStorage.getItem("longitude")+'</longitude>'+
'<altitude>'+window.localStorage.getItem("altitude")+'</altitude>'+
'<heading>-1</heading>'+
'<temp>'+window.localStorage.getItem("temp")+'</temp>'+
'<pressure>'+window.localStorage.getItem("pressure")+'</pressure>'+
'<event>'+window.localStorage.getItem("evnt")+'</event>'+footer;

       window.localStorage.setItem("sentToRocket","N")

        var encodedXml = Encoder.htmlEncode(xmlStr,true);

            $.ajax({
                type: 'GET',
                url: "http://www.rocketremotecontrol.com/RocketXmlService/RocketXmlService.asmx/SendWorkflowXml",
                data: { xmlFileData: JSON.stringify(encodedXml) },
                dataType: "jsonp",
                contentType : "application/json; charset=utf-8",
                processdata: false, 
                    success: function (result) {
                        console.log('in ajax success: '+Encoder.htmlDecode((result.d)));
                        deleteRec(DBRec);
                   console.log('in ajax success: '+Encoder.htmlDecode((result.d)));


                    deleteRec(DBRec);

                        window.localStorage.setItem("sentToRocket","Y");
                        window.location.replace('#p1');

                
                },
                error: function(error) {
                    console.log('ROCKET LOGGING FAILURE!');
                    console.log('Service call failed: ' + error.status + '=' + error.statusText);
                   console.log('Service call failed: ' + error.status + '=' + error.statusText);
                   window.localStorage.setItem("sentToRocket","N");
                }
            });



   }
            
           // clear out the engineering data after it is sent.
            generateTemperatureSelect();
            window.localStorage.setItem("temp",null)
            generatePressureSelect();
            window.localStorage.setItem("pressure",null)
            window.location.replace('#top');
            
           } else {
           indicator.innerHTML = '<img align="left" width="10" height="10" src="img/red.png"><font size = "-1">'+myResponse.errmsg+'</font>';
            
           }
        }
    }
    oXMLHttpRequest.send(null);

}
        numSQLrecs();
        window.location.replace('#p1');    
}

function watchPositionSuccess(position) {

window.localStorage.setItem("latitude",position.coords.latitude);
window.localStorage.setItem("longitude",position.coords.longitude);
window.localStorage.setItem("longitude",position.coords.heading);
window.localStorage.setItem("longitude",position.coords.speed);

}

function watchPositionError(error) {
SLog('Watch Position Error');
}

function geolocationSuccess(position) {
        //window.location.replace('#p1');
        console.log('geo success:'+position.coords.latitude+':'+position.coords.longitude);
        window.localStorage.setItem("Status", 'ONLINE');
        window.localStorage.setItem("latitude",position.coords.latitude);
        window.localStorage.setItem("longitude",position.coords.longitude);
        window.localStorage.setItem("altitude",position.coords.altitude);
        window.localStorage.setItem("accuracy",position.coords.accuracy);
        window.localStorage.setItem("altitudeAccuracy",position.coords.altitudeAccuracy);
        window.localStorage.setItem("heading",position.coords.heading);
        window.localStorage.setItem("speed",position.coords.speed);
if (position.coords.speed >  0) {
 SLog("In motion: Speed:"+position.coords.speed+" heading: "+position.coords.heading+" LAT:"+position.coords.latitude+" LONG:"+position.coords.longitude);
}

//
}


function geolocationFailure() {
window.location.replace('#top');
window.localStorage.setItem("w","geolocationFailure()!!!!");
SLog("geolocationFailure");
window.localStorage.setItem("Status", 'NOGEO');

}



function sendHTTPRequest(str)
     { 
        var xmlhttp = new XMLHttpRequest;

       xmlhttp.open('GET',str,false);
       xmlhttp.setRequestHeader("Content-type","application/x-www-form-urlencoded");
       xmlhttp.onreadystatechange=function()
       {
           if (this.readyState == XMLHttpRequest.DONE) {
                var obj = JSON.parse(this.responseText);
                return obj.success;
           }
       }
    xmlhttp.send(null);
return true;
}

function uploadUnsentRecords(){


window.MacAddressPlugin(
    function (result) {
            window.localStorage.setItem("macAddress",result);
            window.localStorage.setItem("uuid",result);
             window.localStorage.setItem("deviceIsOnline",1);
             macAdd.innerHTML = ('<p>'+result+'</p>');
            SLog('Mac Address:'+result);
    },function (result) {
             window.localStorage.setItem("deviceIsOnline",0);
            SLog('error getting mac address! :'+result);
            mac.innerHTML = ('<p>'+result+'</p>');
});
var localMacAddress = window.localStorage.getItem("macAddr");


var dt = new Date();
var timestamp = dt.getFullYear()+ pad2(dt.getMonth()+1)+ pad2(dt.getDate())+ pad2(dt.getHours())+ pad2(dt.getMinutes())+ pad2(dt.getSeconds());

db.transaction(function(transaction) {
               transaction.executeSql('SELECT * FROM QRData',[], function(transaction, result) {
                                      // success selecting all QRData records.
                                      
                                      if (result != null && result.rows != null) {
                                        for (var i = 0; i < result.rows.length; i++) {
                                            var row = result.rows.item(i);
                                            
var header = '<BusinessRequisition><BusinessRequisitionHeader><ProjectName>GasFrac Asset Monitoring</ProjectName><WorkflowName>UpdateScannedData</WorkflowName></BusinessRequisitionHeader><RequisitionDetails><Device>';

var footer = '</Device></RequisitionDetails></BusinessRequisition>';

if (row.uuid === undefined) {

// if we did not have a mac address when we took the reading... we have one now to make the record valid.
 row.uuid = localMacAddress;
}

var xmlStr = header+'<jID>'+row.jID+'</jID>'+
'<level>'+row.lvl1+'</level>'+
'<cde>'+row.cde+'</cde>'+
'<desc>'+row.uuid+'</desc>'+
'<ts>'+timestamp+'</ts>'+
'<latitude>'+row.latitude+'</latitude>'+
'<longitude>'+row.longitude+'</longitude>'+
'<altitude>'+row.altitude+'</altitude>'+
'<heading>-1</heading>'+
'<temp>'+row.temp+'</temp>'+
'<pressure>'+row.pressure+'</pressure>'+
'<event>'+row.evnt+'</event>'+footer;

var str = "http://"+window.localStorage.getItem("serverIP")+"/gf1.php?"+
                                                      "jID="+encodeURIComponent(row.jID)+
                                                      "&uname=gasfrac"+
                                                      "&passwd=11gasfrac11"+
                                                      "&level="+row.lvl1+
                                                      "&cde="+row.cde+
                                                      "&desc="+row.uuid+
                                                      "&ts="+row.timestamp+
                                                      "&lat="+row.latitude+
                                                      "&long="+row.longitude+
                                                      "&alt="+row.altitude+
                                                      "&heading=-1"+
                                                      "&temp="+row.temp+
                                                      "&pressure="+row.pressure+
                                                      "&event="+encodeURIComponent(row.evnt);
                                      
                                            console.log(str);
                                            if (sendHTTPRequest(str)) {
                                      
                                              //SLog('sendHTTPRequest success, sending record :'+row.id);
                                              var encodedXml = Encoder.htmlEncode(xmlStr,true);
                                              DBRec = row.id;
                                      deleteRec(row.id);


            $.ajax({
                type: 'GET',
                url: "http://www.rocketremotecontrol.com/RocketXmlService/RocketXmlService.asmx/SendWorkflowXml",
                data: { xmlFileData: JSON.stringify(encodedXml) },
                dataType: "jsonp",
                contentType : "application/json; charset=utf-8",
                processdata: false, 
                    success: function (result) {
                        console.log('in ajax success: '+Encoder.htmlDecode((result.d)));
                        window.localStorage.setItem("sentToRocket","Y");
                        window.location.replace('#p1');

                },
                error: function(error) {
                    console.log('ROCKET LOGGING FAILURE!');
                    console.log('Service call failed: ' + error.status + '=' + error.statusText);
                   console.log('Service call failed: ' + error.status + '=' + error.statusText);
                   window.localStorage.setItem("sentToRocket","N");
                }
            });

                                                  
                                            } else {
                                              SLog('sendHTTPRequest failure, sending record :'+row.id);
                                            }
                                        }
                                      }
                                      },function() {
                                            //errorHandler
                                      }
                                      );
               },function() {
                //errorHandler
                },
               function() {
               // nullHandler
               }
               );

}

function onLine() {

window.localStorage.setItem("deviceIsOnline",1);

var media = new Media("weareonline.mp3");
media.play();

//macAddressSuccess();


loadJobIDs();
loadEvents();
    
    SLog("onLine()");
    
    // send all records in DB that have not been sent
uploadUnsentRecords();
window.location.replace('#p1');

}

function offLine() {
window.localStorage.setItem("deviceIsOnline",0);
numSQLrecs();
var media = new Media("wehavenoconnectivity.mp3");
media.play();

//MacAddressError();

loadJobIDs();
loadEvents();

    SLog("offLine()");
    window.location.replace('#p1');
    indicator.html = "DEVICE OFFLINE";
}



// --------------------------------------
function generatePressureSelect() {
   // build the label part
   var buildPressureSelect = '';
   
 buildPressureSelect = buildPressureSelect +'<select class="controls" data-inline="true" name = "pressureSelect" id = "pressureSelect" onchange="setPressure()">\n<option value=null>4.PRESSURE</option>\n';
for (var o=minPressure;o<=maxPressure;o+=5) {
    buildPressureSelect = buildPressureSelect+'<option value=\"'+o+'\">'+o+'</option>\n';
}
buildPressureSelect = buildPressureSelect + '</select>';

$('#pressureDiv').html(buildPressureSelect).trigger('create');
}

// --------------------------------------
function generateTemperatureSelect() {
    
var buildTemperatureSelect='<select class="controls" data-inline="true" name = "temperatureSelect" id = "temperatureSelect" style="font-size:22px" onchange="setTemp()"><option value=null>3. TEMP</option>\n';
for (var o=minTemperature;o<=maxTemperature;o+=5) {
    buildTemperatureSelect = buildTemperatureSelect+'<option value=\"'+o+'\">'+o+'</option>\n';
}
buildTemperatureSelect = buildTemperatureSelect + '</select>';

$('#temperatureDiv').html(buildTemperatureSelect).trigger('create');

}

// --------------------------------------
function generateVolumeSelect() {
    
var buildVolumeSelect = '<select class="controls" data-inline="true" name = "volumeSelect" id = "volumeSelect" style="font-size:22px" onchange="setVolume()"><option value=null>2. VOLUME</option>\n';
for (var o=minVolume;o<=maxVolume;o++) {
    buildVolumeSelect = buildVolumeSelect+'<option value=\"'+o+'\">'+o+'</option>\n';
}
buildVolumeSelect = buildVolumeSelect + '</select>';

$('#volumeDiv').html(buildVolumeSelect).trigger('create');


}


document.addEventListener("offline", offLine, false);
document.addEventListener("online", onLine, false);
document.addEventListener("backbutton", onBackKeyDown, false);
document.addEventListener("deviceready", onDeviceReady, false);

window.onerror = function(err,fn,ln) {console.log("ERROR:" + err + ", " + fn + ":" + ln);};

/* Call orientation function on orientation change */
$(window).bind( 'orientationchange', function(e){
    orient();
});

$(function(){
    orient();
});

db = openDatabase("QRCodeDB", "1.0", "QRCodeDB", 1000000);
navigator.geolocation.clearWatch(watchID);
watchID = navigator.geolocation.watchPosition(watchPositionSuccess,watchPositionError,{ enableHighAccuracy: true});


