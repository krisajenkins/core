Elm.Native.Keyboard = {};
Elm.Native.Keyboard.make = function(localRuntime) {

    localRuntime.Native = localRuntime.Native || {};
    localRuntime.Native.Keyboard = localRuntime.Native.Keyboard || {};
    if (localRuntime.Native.Keyboard.values)
    {
        return localRuntime.Native.Keyboard.values;
    }

    // Duplicated from Native.Signal
    function send(node, timestep, changed) {
        var kids = node.kids;
        for (var i = kids.length; i--; ) {
            kids[i].recv(timestep, changed, node.id);
        }
    }

    var Signal = Elm.Signal.make(localRuntime);
    var NS = Elm.Native.Signal.make(localRuntime);
    var NList = Elm.Native.List.make(localRuntime);
    var Utils = Elm.Native.Utils.make(localRuntime);

    var downEvents = NS.input(null);
    var upEvents = NS.input(null);
    var blurEvents = NS.input(null);

    localRuntime.addListener([downEvents.id], document, 'keydown', function down(e) {
        localRuntime.notify(downEvents.id, e);
    });

    localRuntime.addListener([upEvents.id], document, 'keyup', function up(e) {
        localRuntime.notify(upEvents.id, e);
    });

    localRuntime.addListener([blurEvents.id], window, 'blur', function blur(e) {
        localRuntime.notify(blurEvents.id, null);
    });

    function state(alt, meta, keyCodes) {
        return {
            alt: alt,
            meta: meta,
            keyCodes: keyCodes
        };
    }
    var emptyState = state(false, false, NList.Nil);

    function KeyMerge(down, up, blur) {
        var args = [down,up,blur];
        this.id = Utils.guid();
        // Ignore starting values here
        this.value = emptyState;
        this.kids = [];
        
        var n = args.length;
        var count = 0;
        var isChanged = false;

        this.recv = function(timestep, changed, parentID) {
            ++count;
            if (changed)
            { 
                // We know this a change must only be one of the following cases
                if (parentID === down.id && !A2(NList.member, down.value.keyCode, this.value.keyCodes))
                {
                    isChanged = true;
                    var v = down.value;
                    var newCodes = NList.Cons(v.keyCode, this.value.keyCodes);
                    this.value = state(v.altKey, v.metaKey, newCodes);
                }
                else if (parentID === up.id)
                {
                    isChanged = true;
                    var v = up.value;
                    var notEq = function(kc) { return kc !== v.keyCode };
                    var newCodes = A2(NList.filter, notEq, this.value.keyCodes);
                    this.value = state(v.altKey, v.metaKey, newCodes);
                }
                else if (parentID === blur.id)
                {
                    isChanged = true;
                    this.value = emptyState;
                }
            }
            if (count == n)
            {
                send(this, timestep, isChanged);
                isChanged = false;
                count = 0;
            }
        };

        for (var i = n; i--; ) {
            args[i].kids.push(this);
            args[i].defaultNumberOfKids += 1;
        }
    }

    var keyMerge = new KeyMerge(downEvents,upEvents,blurEvents);

    // select a part of a keyMerge and dropRepeats the result
    function keySignal(f) {
        var signal = A2(Signal.map, f, keyMerge);
        // must set the default number of kids to make it possible to filter
        // these signals if they are not actually used.
        keyMerge.defaultNumberOfKids += 1;
        signal.defaultNumberOfKids = 1;
        var filtered = Signal.dropRepeats(signal);
        filtered.defaultNumberOfKids = 0;
        return filtered;
    }

    // break keyMerge into parts
    var keysDown = keySignal(function getKeyCodes(v) {
        return v.keyCodes;
    });
    var alt = keySignal(function getKeyCodes(v) {
        return v.alt;
    });
    var meta = keySignal(function getKeyCodes(v) {
        return v.meta;
    });

    function dir(up, down, left, right) {
        function toDirections(state) {
            var keyCodes = state.keyCodes;
            var x = 0, y = 0;
            while (keyCodes.ctor === "::") {
                switch (keyCodes._0) {
                case left : --x; break;
                case right: ++x; break;
                case up   : ++y; break;
                case down : --y; break;
                }
                keyCodes = keyCodes._1;
            }
            return { _:{}, x:x, y:y };
        }
        return keySignal(toDirections);
    }

    function is(key) {
        return keySignal(function(v) {
            return A2( NList.member, key, v.keyCodes );
        });
    }

    var lastPressed = A2(Signal.map, function(e) {
        return e ? e.keyCode : 0;
    }, downEvents);
    downEvents.defaultNumberOfKids += 1;

    return localRuntime.Native.Keyboard.values = {
        isDown:is,
        alt: alt,
        meta: meta,
        directions:F4(dir),
        keysDown:keysDown,
        lastPressed:lastPressed
    };

};
