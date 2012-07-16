var Struct = function () {
'use strict'

function createTypedProperty (type) {
    var nameProp = JSON.stringify(type.name)
    var typeName = type.type[0].toUpperCase() + type.type.substr(1)
    var arg = type.isLE ? '' : ', false'

    if (!type.size) return ''

    if (type.count > 1) {
        return nameProp + ':{get:function(){return this.__properties__[' +
            nameProp + ']},set:function(v){this.__properties__[' +
            nameProp + '].set(v)}}'
    }

    return nameProp + ':{get:function(){return this.__dataview__.get' +
        typeName + '(' + type.offset + arg +
        ')},set:function(v){this.__dataview__.set' + typeName + '(' +
        type.offset + ',v' + arg + ')}}'
}

function assignTypedProperty (type) {
    var nameProp = JSON.stringify(type.name)
    var assign = 'if(arguments[' + type.index +
        ']!=null)s[' + nameProp + ']=arguments[' + type.index + '];'

    if (!type.size) return assign

    return (type.count > 1 ? 'p[' + nameProp + ']=new ' + type.ctor.name +
        '(b,' + type.offset + ',' + type.type.count + ');' : '') + assign
}


function createConstructor (types) {
    return Function('return function Struct(' +
        types.map(function (t) {
            return t.name
        }).join(',') +
        '){' +
        'var s=Object.create(Struct.prototype),' +
        'b=new ArrayBuffer(s.length),' +
        'p={};' +
        'Object.defineProperty(s,"__buffer__",{value:b});' +
        'Object.defineProperty(s,"__dataview__",{value:new DataView(b)});' +
        'Object.defineProperty(s,"__properties__",{value:p});' +
        types.map(assignTypedProperty).join('') +
        'return s}')()
}

var knownTypes = {
    'var': Object,

    'int8': Int8Array,
    'uint8': Uint8Array,
    'int16': Int16Array,
    'uint16': Uint16Array,
    'int32': Int32Array,
    'uint32': Uint32Array,
    'float32': Float32Array,
    'float64': Float64Array
}

var typeSizes = {
    'var': 0,

    'int8': 8,
    'uint8': 8,
    'int16': 16,
    'uint16': 16,
    'int32': 32,
    'uint32': 32,
    'float32': 32,
    'float64': 64
}

var staticProperties = {
    fromBuffer: function () {
        var struct = this()

        struct.readFromBuffer.apply(struct, arguments)

        return struct
    }
}

function Struct (properties) {
    var keys = Object.keys(properties)
    var length = 0
    var types = keys.map(function (k, i) {
        var type = /^(\w+)(\[(\d+)\])?$/.exec(properties[k])
        var typeName = type ? type[1] : ''
        var isLE = true

        if (/^\w+(be|le)/.test(typeName)) {
            isLE = typeName.substr(-2) === 'le'
            typeName = typeName.substr(0, typeName.length - 2)
        }

        if (!type || !knownTypes[typeName]) {
            throw TypeError('Unrecognized type "' + properties[k] + '"')
        }

        var count = type[3] ? ~~type[3] : 1

        if (!count) throw TypeError('Invalid count!')

        var size = typeSizes[typeName] * count
        var offset = length

        length += size / 8

        return {
            name: k,
            type: typeName,
            ctor: knownTypes[typeName],
            size: size,
            isLE: isLE,
            count: count,
            index: i,
            offset: offset
        }
    })

    var propMap = types.map(createTypedProperty).filter(function (t) {
        return !!t
    }).join(',')

    var constructor = createConstructor(types)

    constructor.prototype = Object.create(Struct.prototype,
        Function('return{' + propMap + ',length:{value:' +
        length + '}}')())

    return constructor
}

Struct.prototype = {
    readFromBuffer: function (buffer, offset) {
        void (new Uint8Array(this.__buffer__)).set(new Uint8Array(buffer), offset)
    }
}

return Struct

}()
