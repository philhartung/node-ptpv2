# node-ptpv2
IEEE 1588-2008 PTPv2 Client for NodeJS. Tested with ptp4l and in an AES67 Network. Needs to be executed with priviliges, because the PTP client needs to bind to ports < 1000. Implements _Delay_req_ and _Delay_resp_ syncing only.

## Install
` npm install ptpv2 `

## Usage
Example usage:
```
var ptp = require('ptpv2');

ptp.init('192.168.1.100', 0, function(){
	var synced = ptp.is_synced();
	var ptpMaster = ptp.ptp_master();
	var time = ptp.ptp_time();

	console.log(synced, ptpMaster, time);
});
```

### ptpv2.init(address, domain, callback)
Initialize the PTP system. Needs the address of the interface on which the multicast group binds to. Also takes the PTP domain number (0 - 3) and a callback that is executed, when the client synced to the master.

### ptpv2.is_synced()
Returns _false_ when not synced to a PTP Master and _true_ when it is synced.

### ptpv2.ptp_master()
Returns the current PTP Master

### ptpv2.ptp_time()
Returns the current synced up time in an array format as follows: [seconds, nanoseconds].
