# node-ptpv2
IEEE 1588-2008 PTPv2 Client for NodeJS. Tested with ptp4l and in an AES67 Network. Needs to be executed with priviliges, because the PTP client has to bind to ports < 1000. Implements _Delay_req_ and _Delay_resp_ syncing only.

## Install
` npm install ptpv2 `

## Usage
Example usage:
```javascript
var ptpv2 = require('ptpv2');

ptpv2.init('192.168.1.100', 0, function(){
	var synced = ptpv2.is_synced();
	var ptpMaster = ptpv2.ptp_master();
	var time = ptpv2.ptp_time();

	console.log(synced, ptpMaster, time);
});
```

This should output `true '08-00-27-ff-fe-26-55-1f:0' [ 1591294070, 112285378 ]` when synced to a master.

### ptpv2.init(address, domain, callback)
Initialize the PTP system. Needs the address of the interface on which the multicast group binds to. Also takes the PTP domain number (0 - 3) and a callback that is executed, when the client synced to the master.

### ptpv2.is_synced()
Returns _false_ when not synced to a PTP Master and _true_ when it is synced.

### ptpv2.ptp_master()
Returns the current PTP Master

### ptpv2.ptp_time()
Returns the current synced up time in an array format as follows: [seconds, nanoseconds].
