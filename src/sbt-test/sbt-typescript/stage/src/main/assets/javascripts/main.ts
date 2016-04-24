import {Greeter} from "./greeter"
import {Naysayer} from "./naysayer"


var greeter = new Greeter("Hello, world!");

var response = greeter.greet();

var naysayer = new Naysayer("Hello, world!");

var response = naysayer.greet();