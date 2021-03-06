/*--------------------
    app/controllers/ConnectivityFSM

    Controller used to handle connectivity finite state machine logic
--------------------*/
var initConFSM = function() {
    App.httpConnectivity = new HttpConnectivityFsm({
        stethoscope: Stethoscope
    });
    App.httpConnectivity.on("transition", function( data ) {
           $('#content').removeClass( data.fromState ).addClass( data.toState );
           App.log("We're",data.toState);
    });

    App.ajaxManager = new ActManagementFsm({
        httpConnectivityFsm: App.httpConnectivity
    });
};

// We're getting a customized FSM constructor which we
// can use later to create an instance. 
var HttpConnectivityFsm = machina.Fsm.extend({
    
    // we'll assume we're offline and let the app
    // determine when to try and probe for state
    initialState : "offline",

    // The initialize method is invoked as soon as the
    // constructor has completed execution. Here we
    // set up listeners to the various events that
    // could indicate changes in connectivity
    initialize : function () {
        var self = this;
        
        // The "stethoscope" is simply an object that can make a
        // request to a pre-determined HTTP endpoint and emit a
        // heartbeat event if the request is successful, or a
        // no-heartbeat event if it fails.
        _.each( ['heartbeat', 'no-heartbeat'], function ( eventName ) {
            $(self.stethoscope).on( eventName, function () {
                self.handle.call( self, eventName );
            } );
        } );
        
        $( window ).bind( "online", function () {
            self.handle( "window.online" );
        });

        $( window ).bind( "offline", function () {
            self.handle( "window.offline" );
        });

        $( window.applicationCache ).bind( "error", function () {
            self.handle( "appCache.error" );
        });

        $( window.applicationCache ).bind( "downloading", function () {
            self.handle( "appCache.downloading" );
        });
        
        $( document ).on( "resume", function () {
            self.handle( "device.resume" );
        });
    },

    states : {
        probing : {
        
            // the "_onEnter" handler is a special machina
            // feature that gets executed as soon as you
            // enter the state. This is our "entry action".
            _onEnter : function () {
                this.stethoscope.checkHeartbeat();
            },
            
            // We're using a shortcut feature of machina here.
            // If the only action of an input handler is to
            // transition to a new state, then the value of the
            // handler can be the string name of the state to
            // which we should transition, instead of a function.
            "heartbeat"      : "online",
            "no-heartbeat" : "disconnected",
            "go.offline"   : "offline",
            
            // the "*" is a special handler in machina that will
            // be invoked for any input that's not explicitly
            // handled by another handler in the same state.
            "*" : function () {
                this.deferUntilTransition();
            }
        },

        online : {
            "window.offline"  : "probing",
            "appCache.error"  : "probing",
            // the request.timeout event could be hooked into some
            // customization of $.ajax that causes this input to be
            // passed to the FSM when *any* HTTP request times out.
            "request.timeout" : "probing",
            "device.resume"   : "probing",
            "go.offline"      : "offline"
        },

        disconnected : {
            "window.online"        : "probing",
            "appCache.downloading" : "probing",
            "go.online"            : "probing",
            "device.resume"        : "probing",
            "go.offline"           : "offline"
        },

        offline : {
            "go.online" : "probing"
        }
    },
    // wrapper functions to allow App.httpConnectivity.goOnline(); and App.httpConnectivity.goOffline();
    // as convienience functions.
    goOnline: function() {
        this.handle('go.online');
    },
    goOffline: function() {
        this.handle('go.offline');
    }
});

var Stethoscope =  {
    // simple heartbeat act call -cloud side immediately returns a response.
    checkHeartbeat : function () {
        var self = $(this);
        self.trigger( 'checking-heartbeat' );
        Act.call("heartbeat", {},
            function(res){
                 self.trigger( 'heartbeat' );
            }, function(msg, err){
                 self.trigger( 'no-heartbeat' );
            }
        );
    }
};
