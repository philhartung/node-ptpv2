var dgram = require('dgram');

//ptp settings
var ptp_domain = 0;
var ptpMaster = '';
var sync = false;
var addr = '127.0.0.1';
var cb = function(){};
var minSyncInterval = 10000; // in ms

//PTPv2
var ptpClientEvent = dgram.createSocket({ type: 'udp4', reuseAddr: true });
var ptpClientGeneral = dgram.createSocket({ type: 'udp4', reuseAddr: true });
var ptpMulticastAddrs = ['224.0.1.129', '224.0.1.130', '224.0.1.131', '224.0.1.132'];

//vars
var t1, ts1, t2, ts2;
var offset = [0, 0];
var sync_seq;
var req_seq = 0;
var lastSync = 0;

//functions
//creates ptp delay_req buffer
var ptp_delay_req = function(){
	var length = 52;
	var buffer = Buffer.alloc(length);
	req_seq = (req_seq + 1) % 0x10000;
	
	buffer.writeUInt8(1, 0);
	buffer.writeUInt8(2, 1);
	buffer.writeUInt16BE(length, 2);
	buffer.writeUInt16BE(req_seq, 30);
	
	return buffer;
}

var getCorrectedTime = function(){
	var time = process.hrtime();
	var timeS = time[0] - offset[0];
	var timeNS = time[1] - offset[1];

	return [timeS, timeNS];
}

//export functions
//calculated ptp time
exports.ptp_time = function(){
	var time = process.hrtime();
	var timeS = time[0] - offset[0];
	var timeNS = time[1] - offset[1];

	return [timeS, timeNS];
}

exports.is_synced = function(){
	return sync;
}

exports.ptp_master = function(){
	return ptpMaster;
}

exports.init = function(interface, domain, callback){
	addr = interface ? interface : '127.0.0.1';
	ptp_domain = domain ? domain : 0;
	cb = callback ? callback : function(){};

	ptpClientEvent.bind(319);
	ptpClientGeneral.bind(320);
}

//event msg client
ptpClientEvent.on('listening', function() {
	ptpClientEvent.setMulticastInterface(addr);
	ptpClientEvent.addMembership(ptpMulticastAddrs[ptp_domain], addr);
});

ptpClientEvent.on('message', function(buffer, remote) {
	var recv_ts = getCorrectedTime();//safe timestamp for ts1

	//check buffer length
	if(buffer.length < 31)
		return;

	//read values from buffer
	var type = buffer.readUInt8(0) & 0x0f;
	var version = buffer.readUInt8(1);
	var length = buffer.readUInt16BE(2);
	var domain = buffer.readUInt8(4);
	var flags = buffer.readUInt16BE(6);
	var source = buffer.toString('hex', 20, 28).match(/.{1,2}/g).join('-')+':0';
	var sourceAlt = buffer.toString('hex', 20, 28).match(/.{1,2}/g).join(':');
	var sequence = buffer.readUInt16BE(30);

	if(version != 2 || domain != ptp_domain)//check for version 2 and domain 0
		return;

	if(type != 0)//only process sync messages
		return;

	//do we have a new ptp master?
	if(source != ptpMaster){
		ptpMaster = source;
		sync = false;
	}

	//save sequence number
	sync_seq = sequence;

	//check if master is two step or not
	if((flags & 0x0200) == 0x0200){
		//two step, wait for follow_up msg for accurate t1
		ts1 = recv_ts;
	}else if(Date.now() - lastSync > minSyncInterval){
		//got accurate t1 (no follow_up msg)
		ts1 = recv_ts;

		//read t1 timestamp
		var tsS = (buffer.readUInt16BE(34) << 4) + buffer.readUInt32BE(36);
		var tsNS = buffer.readUInt32BE(40);
		t1 = [tsS, tsNS];

		//send delay_req
		ptpClientEvent.send(ptp_delay_req(), 319, ptpMulticastAddrs[ptp_domain], function(){
			t2 = getCorrectedTime();
		});

		t2 = getCorrectedTime();
	}
});

//general msg Client
ptpClientGeneral.on('listening', function() {
	ptpClientGeneral.addMembership(ptpMulticastAddrs[ptp_domain], addr);
});

ptpClientGeneral.on('message', function(buffer, remote) {
	//safe timestamp for ts2
	var recv_ts = getCorrectedTime();

	//check buffer length
	if(buffer.length < 31)
		return;

	//read values from buffer
	var type = buffer.readUInt8(0) & 0x0f;
	var version = buffer.readUInt8(1);
	var length = buffer.readUInt16BE(2);
	var domain = buffer.readUInt8(4);
	var flags = buffer.readUInt16BE(6);
	var source = buffer.toString('hex', 20, 28).match(/.{1,2}/g).join('-')+':0';
	var sequence = buffer.readUInt16BE(30);

	//check for version 2 and domain
	if(version != 2 || domain != ptp_domain)
		return;

	if(type == 0x08 && sync_seq == sequence && Date.now() - lastSync > minSyncInterval){ //follow up msg with current seq
		//read t1 timestamp
		var tsS = (buffer.readUInt16BE(34) << 4) + buffer.readUInt32BE(36);
		var tsNS = buffer.readUInt32BE(40);
		t1 = [tsS, tsNS];

		//send delay_req
		ptpClientEvent.send(ptp_delay_req(), 319, ptpMulticastAddrs[ptp_domain], function(){
			t2 = getCorrectedTime();
		});

		t2 = getCorrectedTime();

	}else if(type == 0x09 && req_seq == sequence){ //delay_rsp msg
		//read ts2 timestamp
		var tsS = (buffer.readUInt16BE(34) << 4) + buffer.readUInt32BE(36);
		var tsNS = buffer.readUInt32BE(40);
		ts2 = [tsS, tsNS];

		//calc offset
		let delta = (0.5 * (ts1[0] - t1[0] - ts2[0] + t2[0])) * 1000000000 + 0.5 * (ts1[1] - t1[1] - ts2[1] + t2[1]);

		let deltaSplit = [0, 0];
		deltaSplit[1] = (delta % 1000000000);
		deltaSplit[0] = Math.round((delta - deltaSplit[1]) / 1000000000);

		offset[0] += deltaSplit[0];
		offset[1] += deltaSplit[1];
		lastSync = Date.now();

		//check if the clock was synced before
		if(!sync){
			sync = true;
			cb();
		}
	}
});
