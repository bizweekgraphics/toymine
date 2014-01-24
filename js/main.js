// u.s. census popular birth names in 1980 http://www.ssa.gov/cgi-bin/popularnames.cgi
var names = ["Michael","Christopher","Jason","David","James","Matthew","Joshua","John","Robert","Joseph","Daniel","Brian","Justin","William","Ryan","Eric","Nicholas","Jeremy","Andrew","Timothy","Jonathan","Adam","Kevin","Anthony","Thomas","Richard","Jeffrey","Steven","Charles","Brandon","Mark","Benjamin","Scott","Aaron","Paul","Nathan","Travis","Patrick","Chad","Stephen","Kenneth","Gregory","Jacob","Dustin","Jesse","Jose","Shawn","Sean","Bryan","Derek","Bradley","Edward","Donald","Samuel","Peter","Keith","Kyle","Ronald","Juan","George","Jared","Douglas","Gary","Erik","Phillip","Joel","Raymond","Corey","Shane","Larry","Marcus","Zachary","Craig","Derrick","Todd","Jeremiah","Antonio","Carlos","Shaun","Dennis","Frank","Philip","Cory","Brent","Nathaniel","Gabriel","Randy","Luis","Curtis","Jeffery","Russell","Alexander","Casey","Jerry","Wesley","Brett","Luke","Lucas","Seth","Billy","Jennifer","Amanda","Jessica","Melissa","Sarah","Heather","Nicole","Amy","Elizabeth","Michelle","Kimberly","Angela","Stephanie","Tiffany","Christina","Lisa","Rebecca","Crystal","Kelly","Erin","Laura","Amber","Rachel","Jamie","Mary","April","Sara","Andrea","Shannon","Megan","Emily","Julie","Danielle","Erica","Katherine","Maria","Kristin","Lauren","Kristen","Ashley","Christine","Brandy","Tara","Katie","Monica","Carrie","Alicia","Courtney","Misty","Kathryn","Patricia","Holly","Stacy","Karen","Anna","Tracy","Brooke","Samantha","Allison","Melanie","Leslie","Brandi","Cynthia","Susan","Natalie","Jill","Dawn","Dana","Vanessa","Veronica","Lindsay","Tina","Kristina","Stacey","Wendy","Lori","Catherine","Kristy","Heidi","Sandra","Jacqueline","Kathleen","Christy","Leah","Valerie","Pamela","Erika","Tanya","Natasha","Katrina","Lindsey","Melinda","Monique","Denise","Teresa","Tammy","Tonya","Julia","Candice","Gina","Toph","Evan","Dorothy","Cindy"];

// constructor
function block() {
	this.mined = false;
	this.transactions = new Array();
	this.nonce = null;
	this.hash = null;
}

// constructor
// * http://stackoverflow.com/a/8084248/120290
function transaction() {
	this.sender = randName();
	this.senderAddr = Math.random().toString(36).substring(7); // *
	this.recipient = randName();
	this.recipientAddr = Math.random().toString(36).substring(7);
	this.amount = Math.round(Math.abs(normalRand(transMean,transSD))*1000) / 1000; 	
	this.valid = Math.random() > fraudProportion;
}
transaction.prototype.toString = function() {
	return this.sender+" → "+" Ⓑ "+this.amount.toFixed(3)+" → "+this.recipient;
}

// constructor
function hash(input) {
	this.input = input;
	this.outputHex = CryptoJS.SHA256(this.input).toString(CryptoJS.enc.Hex);
	this.outputDec = parseInt(this.outputHex, 16);
	this.outputScaled = hashScale(this.outputDec);
}

// nice http://www.protonfish.com/random.shtml
function normalRand(mean, sd) {
	return sd*(Math.random() + Math.random() + Math.random()) + mean;
}

function randName() {
	return names[Math.floor(Math.random() * names.length)];
}

function drawTransaction(parent,x,y) {
	var trans = new transaction();
	parent.append("text")
		.text(trans.valid ? trans.toString()+" ✓ " : trans.toString())
		.classed("transaction", true)
		.attr("x",x)
		.attr("y",y)
		.attr("opacity", 0)
		.attr("class", trans.valid ? "success" : "rejected");
	return trans;
}

function drawTransactions(parent,x,y,n) {
	for(i = 0; i<n; i++) {
		drawnTrans = drawTransaction(parent,x,y+lineHeight*i);
		block.transactions += drawnTrans.toString()+";";
		if(drawnTrans.valid) blockchain[blockchain.length-1].transactions.push(drawnTrans.toString());
	}
	parent.selectAll("text").each(function(d,i) {
		d3.select(this).transition()
			.delay(i*100/mineRate)
			.duration(100/mineRate)
			.attr("opacity",1);
	});
	d3.timer(nextStep, 1500/mineRate);
	console.log(blockchain);
}

function drawArrow(parent, from, to, degrees) {
	// "degrees" should be angle subtended by arc of arrow
	// typical bizweek style is either 45 or 90
	
	// read up: http://www.w3.org/TR/SVG/paths.html#PathDataEllipticalArcCommands
	// example: <path d = "M 200 50 a 90 90 0 0 1 100 0"/>
	
	var path = "M " + from[0] + " " + from[1] + " a 90 90 0 1 1 " + (to[0]-from[0]) + " " + (to[1]-from[1]);
	
	parent.append("path")
		.attr("d", path)
		.attr("marker-end", "url(#arrowhead)");
	return path;
}

////////////////////////////////////////////////////////////////////////////////
// WALLET //////////////////////////////////////////////////////////////////////

// helpful:
// https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
// https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/Using_XMLHttpRequest
function getPrice() {
	req=new XMLHttpRequest();
	req.onload = drawPrice;
	req.open("get","http://api.coindesk.com/v1/bpi/currentprice.json",true);
	req.send();
	
	//error handling should be better. will onload be called if it fails? hm.
}

function drawPrice() {
	response = JSON.parse(this.responseText);
	USDrate = Math.round(response.bpi.USD.rate);
	
	//in sidebar text, update the current value of 25 bitcoins
	d3.select("#btc25").html((25*USDrate).toLocaleString());
}

function updateWallet(d) {
	wallet += d;
	d3.select("#bitcoins-earned").text("Ⓑ"+(Math.round(wallet*100)/100).toLocaleString());
	d3.select("#usd-earned").text("$"+(Math.round(wallet*USDrate*100)/100).toLocaleString());
	// "toLocaleString()" adds a thousands separator
}

////////////////////////////////////////////////////////////////////////////////
// AUTO-MINER //////////////////////////////////////////////////////////////////

var autoMinerTimer;
function startAutoMine() {
  autoMinerTimer = setInterval(autoMine, 1000);
}
function stopAutoMine() {
  clearInterval(autoMinerTimer);
}

function buyMiner() {
	if(wallet>=minerPrice) {
		
		// update variables
		mineRate++;
		updateWallet(-minerPrice);
		minerPrice *= minerPriceInflationRate; //supply & demand, baby.
		
		// adapt target difficulty (& redraw) to keep estimated block solve time steady
		// (like in real bitcoin)
		targetProportion *= (mineRate-1)/mineRate;
		d3.select("#target").attr("y2", hashHeight*targetProportion);
		
		// if you can't buy any more miners, hide buy button
		// (it's important that this happens *after* miner price is updated)
		if(wallet<minerPrice) {
			d3.select("#buy").attr("display","none");
		}
		
		// set a new interval timer to represent the new miner
		// #todo: a better thing might be to update any existing interval timer
		startAutoMine();
		
		// update the footer stats
		d3.select("#stat-probability").html(Math.round(100*targetProportion)+"%");
		d3.select("#stat-miners").html(mineRate-1);
		d3.select("#stat-miners-item").classed("hidden",false);
		
		//draw ASIC flying from buy button into footer stat
		// #todo: doesn't look right if you buy multiple in quick succession
		d3.select("#asic")
			.attr("opacity","1")
			.transition()
				.attr("transform","translate(453 570) scale(0.2)")
				.duration(1000)
				.transition()
					.attr("opacity",0)
					.duration(500)
					.each('end', function() { d3.select("#asic").attr("transform","translate(575 100) scale(0.5)"); });
	}
}

function autoMine() {
	drawHash(block.transactions, Math.random()*nonceHeight, true);
}

////////////////////////////////////////////////////////////////////////////////
// "STEPS" // (sorry Larry Tesler) /////////////////////////////////////////////

function setStep(newStep) {
	step = newStep;
	if(step == 1) {
		// move the chevron
		d3.select("#instructions").transition().duration(100/mineRate).attr("transform","translate(120 -80)");
		
		// show the correct step text
		d3.select("#step1").attr("display","inherit");
		d3.select("#step2").attr("display","none");
		d3.select("#step3").attr("display","none");
		
		// disable mining
		miningToggle = false;
	} else if(step==2) {
		// move the chevron
		d3.select("#instructions").transition().duration(100/mineRate).attr("transform","translate(320 -80)");
		
		// show the correct step text
		d3.select("#step1").attr("display","none");
		d3.select("#step2").attr("display","inherit");
		d3.select("#step3").attr("display","none");

		// enable mining
		miningToggle = true;
	} else if(step==3) {
		// move the chevron
		d3.select("#instructions").transition().duration(100/mineRate).attr("transform","translate(470 -80)");
		
		// show the correct step text
		d3.select("#step1").attr("display","none");
		d3.select("#step2").attr("display","none");
		d3.select("#step3").attr("display","inherit");

		// disable mining
		miningToggle = false;
	}
	return true;
}

function nextStep() {
	return setStep(step+1);
}