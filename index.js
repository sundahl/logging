
const morgan = require('morgan')
const {omit, get, pick, noop} = require('lodash')
const uid = require('unique-string')
const s3 = require('@sundahl/s3')

const package = require('../package.json')
const LOG_BUCKET = 'io-sundahl-logs'

morgan.token('id', req => req.id)
morgan.token('instance', req => req.instance)
morgan.token('body', req => omit(req.body, ['password']))
morgan.token('cookies', req => req.cookies)
morgan.token('query', req => req.query)
morgan.token('params', req => req.params)
morgan.token('headers', req => omit(req.headers, ['Authorization', 'authorization']))
morgan.token('error', req => pick(req.error, ['name', 'message', 'code', 'status']))
morgan.token('ip', req => req.ip)
morgan.token('ips', req => req.ips)

module.exports = function (req, res) {
	req.id = uid()
	if (process.env.NODE_ENV === 'production') {
		morgan(format, { stream: createSpacesStream() })(req, res, noop)
		morgan(format, {skip: (req, res) => res.statusCode < 500 })(req, res, noop)
	} else {
		morgan(format)(req, res, noop)
	}
}

function format(tokens, req, res) {
	return JSON.stringify({
		'service': package.name,
		'id': tokens.id(req, res),
		'version': package.version,
		'time': tokens.date(req, res, 'iso'),
		'ip': tokens.ip(req),
		'ips': tokens.ips(req),
		'user': get(req, 'user.id'),
		'method': tokens.method(req, res),
		'url': tokens.url(req, res),
		'status': tokens.status(req, res),
		'latency': tokens['response-time'](req, res),
		'headers': tokens.headers(req, res),
		'params': tokens.params(req, res),
		'query': tokens.query(req, res),
		'body': tokens.body(req, res),
		'cookies': tokens.cookies(req, res),
		'user-agent': tokens['user-agent'](req, res),
		'http-version': tokens['http-version'](req, res),
		'referrer': tokens.referrer(req, res),
		'remote-addr': tokens['remote-addr'](req, res),
		'error': tokens.error(req, res)
	}, null, 2)
}

function createSpacesStream() {
	function write(str) {
		const event = JSON.parse(str)
		s3.upload({Bucket: LOG_BUCKET, Key: `${event.service}/${Date.now()}.${event.id}`, Body: str}).promise()
	}
	return { write: write }
}
