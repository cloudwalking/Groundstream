var DEBUG = false;
var Services = [
    {   
		name: "twitpic",
        domain: "twitpic.com",
        sample: "http://twitpic.com/123456", 
        transform: function(url){ return url.replace("twitpic.com/", "twitpic.com/show/large/") }
    },
//    {   
//		  domain: "instagr.am",
//        sample: "http://instagr.am/p/CIW2h", 
//        transform: function(url){ return url+'/media?size=m'; }
//    },
    {   
		name: "yfrog",
        domain: "yfrog.com",
        sample: "http://yfrog.com/12345678", 
        transform: function(url){ return url+':medium' }
    }
//	,
//	{
//		name: "tco",
//		domain: "t.co",
//		sample: "http://t.co/L9QFnRp9",
//		transform: function(url) { return url }
//	}
];

$(function() {
    // get lat/lon from place
    if(window.location.hash)
        $('#woof').val(window.location.hash.replace('#', ''));

    var run_timeout; // instant search: save the httprequest so we can kill it
    var searchPlace = $('#woof').val();
    
    run(searchPlace);
    
    $('#woof').keyup(function(event) {
        clearTimeout(run_timeout);
        searchPlace = $('#woof').val();

        // when a key is struck, clear the future RUN call
        if(run_timeout) {
            if(DEBUG) console.log('abort!'); 
            run_timeout.abort;
        }
        
        if(event.keyCode == 13) {
            // return key
            run_timeout.abort;
            run(searchPlace);
        } else if(event.keyCode >= 65 && event.keyCode <= 90)  {
            run_timeout = setTimeout(function(){run(searchPlace)}, 500);
        }
    });
});

// can't bind or live the error method, unfortunately. bug in safari, firefox, etc
// http://forum.jquery.com/topic/error-event-with-live
// have to hack it in: <img onerror="javascript:groundstream_imgErr(this)" ...
function groundstream_imgErr(thing) {
	// if we're in prod, hide all broken images
    if(!DEBUG) $(thing).parent().parent().css('display', 'none');
}

function stopLoading() {
    if(window.stop !== undefined)
    {
         window.stop();
    }
    else if(document.execCommand !== undefined)
    {
         document.execCommand("Stop", false);
    }
}

var runcount = 0;

function run(searchPlace) {
    if(DEBUG) console.log('run '+runcount++);
    
    var geocoder = new google.maps.Geocoder();

    window.location.hash = searchPlace;
	if(DEBUG) console.log(searchPlace);

    $('#crunch').html('loading!');
    
    if(geocoder) {
        
        geocoder.geocode({ 'address': searchPlace }, function (results, status) {
            if (status == google.maps.GeocoderStatus.OK) {
                var lat = results[0].geometry.location.lat();
                var lon = results[0].geometry.location.lng();

                if(DEBUG) console.log('searching around '+lat+','+lon);
                search(lat+','+lon);
            }
            else {
                if(DEBUG) console.log("Geocoding failed: " + status);
            }
        });
    }
}

function search(location) {
    if(DEBUG) console.log('waiting for response...');

    var place = location;
    var accuracy = '100';
    var extras = '';

	// for(var service in Services) {
	// 	console.log(service);
	// }
    
    place = place+','+accuracy+'mi';

    var query = "http://search.twitter.com/search.json?q=twitpic OR yfrog "+extras+"&geocode="+place+"&rpp=100&include_entities=true";
    if(DEBUG) console.log(query);

    var fetch = $.ajax({
        type:'GET',
        url:query,
        data:"callback=?",
        success:function(feed) {
            if(DEBUG) console.log('parsing...');
            $('#crunch').html('');
            
            var tweets = [];
            for(var i=0; i<feed.results.length; i++) {
                tweets.push(feed.results[i]);
            }
            
            groundstream_render(tweets);   
        },
        dataType:'jsonp'
    });
}

function groundstream_render(tweets) {
    var seen = []; // keep a list of urls we've seen so we don't repeat
    var tweet;
    var service;
	
	// loop all tweets
	// don't change this to a foreach, it's done like this on purpose
    for(var i=0; i<tweets.length; i++) {
        tweet = tweets[i];
        
		// loop each service
		// don't change this to a foreach, it's done like this on purpose
        for(var j=0; j<Services.length; j++) {
            service = Services[j];
            var url, location, size, img;


			if(DEBUG) console.log(tweet);

			if(typeof tweet.entities.urls == 'undefined') {
				// someone just said "twitpic" or somesuch, no actual url
				break;
			}
			
			// TODO: only works with the first url in the tweet. should work with all urls (more than one twitpic)
			if(typeof tweet.entities.urls[0].expanded_url != 'undefined') {
				url = tweet.entities.urls[0].expanded_url;
			} else {
				url = tweet.entities.urls[0].url;
			}
			
			// save the url in the tweet for easyness later
			tweet.gs_url = url;
			if(url.indexOf(service['domain']) <= 0) {
				continue;
			}
        
			img = service['transform'](url);
			tweet.gs_thumbnail = img;
        
            // be sure we haven't seen this one before
            // (filters out RTs)
            if($.inArray(img, seen) < 0) {
                seen.push(img);
                
                var now = new Date();
                var then = new Date(tweet.created_at);
                var diff = .001 * (now.getTime() - then.getTime());
                
                if(diff < 60)
                    diff = Math.round(diff) + ' seconds';
                else if(diff < 120)
                    diff = '1 minute';
                else if(diff < 60*60)
                    diff = Math.round(diff/60) + ' minutes';
                else if(diff < 60*60*24)
                    diff = Math.round((diff/60)/24) + ' hours';
                else
                    diff = Math.round(((diff/60)/24)/7) + ' days';
                
                $('#crunch').append(groundstream_tweetHTML(tweet, diff));
            }
            // found the right service. done with this tweet.
            break;
        }
    }

	//groundstream_done();
}

// Gets the first URL written in a tweet
function groundstream_parseURL(tweet, service) {
	if(tweet.text.indexOf(service['domain']) == 0) {
		return false;
	}
	var location = tweet.text.indexOf("http:");
    var size = service['sample'].length;
    return tweet.text.substring(location, location+size);
}

function groundstream_tweetHTML(tweet, time) {
	var big_url = tweet.gs_url
	var thumb_url = tweet.gs_thumbnail;
    return '<div class="img"><a href="'+big_url+'"><img onerror="javascript:groundstream_imgErr(this)" src="'+thumb_url+'"></a><br />'+time+' ago</div>';
}

function groundstream_load_town(town) {
	$('#woof').val(town);
	run(town);
}


function groundstream_getUrlVars()
{
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    return vars;
}